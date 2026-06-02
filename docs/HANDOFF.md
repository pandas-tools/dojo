# Dojo — Handoff (2026-06-02)

> Source-of-truth snapshot for picking up Dojo cold. Updated when scope shifts.
> Read this first; then `spec.md`, `architecture.md`, `decisions.md`, `deploy.md`.

## What Dojo is

**Dojo is the internal training portal for retail employees of our clients.** A new client signs Pandas → their store employees need to learn the platform (Vision AI assessments, trade-in flows, etc.) → Dojo is how we train them at scale without sending a person on-site.

- **Audience:** retail employees of telco operators, retailers, and Apple Premium Partners — many are on mobile, in-store, between customers.
- **Format:** short content lessons delivered Reels/TikTok-style. Vertical, full-screen, swipe-to-next.
- **Mobile-first is a hard constraint** (spec §1.1). Most employees view on mobile.
- **Whitelisted email domains only.** No passwords. Magic-link sign-in via Resend. Per-client domain allowlist.
- **Eventual domain:** `learn.pandas.io`. Currently `web-s2cr-production.up.railway.app`.

## Status as of 2026-06-02

**Pre-production.** No external client employees are using it yet; the public Railway URL is internal-only. Optimised for speed of iteration — direct commits to `main`, no PR review gate, no `develop` branch. This rule lapses when real client employees come online (spec'd in `/apps/dojo/CLAUDE.md`).

**Live URL:** https://web-s2cr-production.up.railway.app
**Login:**
- Admin: `dimitris@pandas.io` (in `ADMIN_ALLOWLIST` env var)
- Employee (Orange Belgium seed): `dimitris@parallel9.com` (in `parallel9.com` allowed domain)

**Dev magic-link URL gate:** `DEV_LOG_MAGIC_LINKS=1` is set on Railway. The magic link URL is logged to `environmentLogs` ~15s after a sign-in trigger. Pull it via the Railway GraphQL API:
```
POST https://backboard.railway.com/graphql/v2  Authorization: Bearer $RAILWAY_API_TOKEN
{ environmentLogs(environmentId: "f6e41437-0cd1-442e-8dd5-3d4b540930f0", beforeLimit: 50, filter: "DEV_MAGIC_LINK email=<addr>") { timestamp message } }
```
Helper script Iris left at `/tmp/dojo-login.sh` automates this. Flip the env var off when going live.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 App Router | Server Components by default |
| Language | TypeScript strict | |
| Styling | Tailwind v4 | Tokens in `src/app/globals.css` `@theme`. UI primitives at `src/components/ui/`. |
| Database | Postgres on Railway | `DATABASE_URL` from Railway reference var |
| ORM | Drizzle | Schema at `src/lib/db/schema.ts` |
| Auth | Auth.js v5 + Resend | Magic-link, JWT sessions, sender `noreply@mkt.pandas.io` |
| Video | Mux | Direct-upload from browser; webhook signature-verified at `/api/webhooks/mux` |
| Images | ImageKit | Server-proxied upload at `/api/admin/lessons/upload-image`. **Creds not yet on Railway env — operator action pending.** |
| Tests | Vitest | Integration tests for auth, tenant isolation, Mux webhook |
| Deploy | Railway | Web + Postgres in one project. Project id `e0bf2e2d-cd72-47ab-85a8-7286d8972198`, environment `f6e41437-0cd1-442e-8dd5-3d4b540930f0`, web service `f6de1fcf-07ee-4144-9f78-4d45ce293f0d` |

## Architecture invariants (non-negotiable)

1. **App-layer tenant scoping.** Every employee-facing query goes through `src/lib/db/scoped.ts → scopedDb(user)`. Never touch a tenant table without it. Integration test fails the build if bypassed.
2. **Admin write routes self-authorize.** `session.user.role === 'admin'` checked server-side, not just in middleware.
3. **Mux webhook signature.** Verified with `MUX_WEBHOOK_SECRET` (HMAC-SHA256) before doing anything with the payload. `MUX_WEBHOOK_SECRET` is `.required()` in env (not `.optional()`).
4. **No `--no-verify`, no `--force main`.** Fix the underlying issue.

## Data model snapshot (post-2026-06-02 bundle)

Tables relevant to the lesson surface:

- `lessons` — `id, internal_name, type ('training'|'announcement'|'update'), content_type ('video'|'image'|'carousel', default 'video'), sort_order, is_published, created_at`
- `lesson_translations` — `(lesson_id, language)` unique; carries the per-language `title, description, notes_markdown`. Plus content-type-specific media columns:
  - Video: `mux_playback_id, mux_asset_id, mux_upload_id, duration_seconds, thumbnail_url`
  - Image: `image_url, image_alt`
  - Carousel: `carousel_slides jsonb` — ordered `[{url, alt, caption?}, ...]`
- `client_lessons` — junction (which clients see which lessons)
- `lesson_completions` — kept for legacy rating data (`rating int`, 1–5). Completion status is now computed from `lesson_events`, NOT from "row exists in this table." Historical rating rows have been backfilled into `lesson_events` as `lesson_completed` so analytics history doesn't disappear.
- `lesson_events` — append-only event log. Event types: `lesson_opened`, `lesson_completed`, `lesson_engagement`, `rating_submitted`. Payload is jsonb (`engagedMs`, `currentTime`, `dwellMs`, `slidesViewedPct`, `rating`, etc.).
- `users, clients, client_allowed_domains, client_languages, stores, accounts, sessions, verificationTokens` — Auth.js + tenant infra.

## Three content types (locked 2026-06-02)

Every lesson is one of:

| Content type | Authoring | Employee viewer | Completion criteria |
|---|---|---|---|
| **Video** | Drag-drop file → Mux direct-upload → webhook fills `mux_playback_id` | `VideoLessonViewer` (Mux player) | 90% of duration watched |
| **Image** | Drag-drop one image → ImageKit via `/api/admin/lessons/upload-image` → ImageKit URL stored | `ImageLessonViewer` | 5 seconds of visible dwell |
| **Carousel** | Drag-drop multiple images → sequential ImageKit uploads → ordered slide list with alt-per-slide | `CarouselLessonViewer` | All slides viewed |

Text-only lessons are explicitly out of scope (removed from the New Lesson dialog 2026-06-02). Carousels of text-slides are the way to do text content — the designer makes them as images.

## Event model (locked 2026-06-02)

Three event names with content-type-dependent triggers:

- `lesson_opened` — auto-fires on mount of the viewer
- `lesson_completed` — content-type-specific (above)
- `lesson_engagement` — heartbeats every 15s with cumulative `engagedMs`. "Engaged" = visible AND (active in last 30s OR a video is currently playing). Final heartbeat on `pagehide`/`visibilitychange-hidden` via `sendBeacon` so the count survives a tab close.
- `rating_submitted` — separate from completion. Rating stays 1–5 stars for now (thumbs migration deferred).

The hook is `src/lib/useLessonTracking.ts`. Returns `{ emitOpened, emitCompleted, emitRating }`. Auto-fires `lesson_opened` + engagement heartbeats. Caller decides when to call `emitCompleted` per content-type rules.

**Comments are deferred entirely.** Open question: comments vs feedback vs questions — undecided.

## Admin surface (workflows that exist)

The full inventory is in the consolidated workflow list locked 2026-06-02 (27 existing + ~13 missing). Headline surfaces:

- **Overview** (`/admin`) — stat cards (clients/lessons/employees/completions), clients hover-list.
- **Lessons** (`/admin/lessons`) — list with status pills, per-translation status dots, reorder, "New lesson" CTA opening the content-type-aware dialog. Detail page at `/admin/lessons/[id]` has Metadata · Translations · Assignments · Danger zone.
- **Clients** (`/admin/clients`) — clickable cards with stats. Detail page has Details · Allowed domains · Languages · Assigned lessons (chip toggle, bidirectional with lesson-side assignment) · Stores (CSV import) · Employees (top 25) · Danger zone.
- **Members** (`/admin/members`) — admin email allowlist. DB-managed admins + `ADMIN_ALLOWLIST` env-bootstrap admins (latter flagged with "bootstrap" badge).
- **Analytics** (`/admin/analytics`, `/admin/analytics/[clientId]`) — store activation %, trained employees %, avg rating, training funnel, per-store completion, per-lesson breakdown, employee list, 30-day activity timeline. **Reads completion status from `lesson_events`, NOT from `lesson_completions`.**

UI primitives at `src/components/ui/`: Button, Dialog, Input, Label, Textarea, Select, Switch, Card, Badge, EmptyState, PageHeader, Sheet (mobile drawer), Toaster (sonner).

Mobile: parent layout is `flex-col sm:flex-row`. Mobile top bar with hamburger → Sheet drawer reusing the same nav. Tables sit in `overflow-x-auto`. Dialog width capped to `calc(100vw-1rem)` so modals don't run edge-to-edge on small screens.

## Employee surface (Reels-style)

- `/login` — single email input, calls `/api/auth/check-domain` then `signIn('resend', {email})`.
- `/onboarding` — first-time + 30-day re-confirmation gate (store + language). Pre-fills current values on re-confirm.
- `/browse` — Netflix-grid escape surface (opt-in).
- `/watch/[id]` — Reels shell. Renders one of `VideoLessonViewer` / `ImageLessonViewer` / `CarouselLessonViewer` based on `lesson.contentType`. RatingWidget below.
- Returning users land on `/watch/<first incomplete lesson>` (not `/browse`).

## Lane split

Backend (always Dex): DB schema, server actions, API routes, integrations (Mux, Resend, ImageKit, Auth.js), validation, business logic, auth, deploys, env, performance.

Frontend (always Iris): every visible surface — components, layout, motion, styling, user-facing experience.

Workflow design (Iris drives): what steps the user takes, in what order, what each screen looks like. Dex surfaces backend constraints DURING the design phase, not after.

## Recent commits (most recent first)

| Commit | What |
|---|---|
| `d4073f0` | `docs(handoff)`: Dex's engineering enhancement pass on HANDOFF.md (Dex) |
| `50c9506` | `feat`: analytics + browse read completion from lesson_events, not ratings (Dex) |
| `d30005b` | `docs(handoff)`: first pass of this handoff document (Iris) |
| `f1ea6b9` | `feat(watch)`: three-way content-type renderer + lesson tracking wired (Iris) |
| `f639acb` | `feat(admin)`: NewLessonDialog content-type picker + image/carousel uploaders (Iris) |
| `fb181b1` | `feat`: ImageKit upload + lesson_events endpoint + tracker hook + image/carousel actions (Dex) |
| `4063466` | `feat(schema)`: content_type enum + image/carousel media + lesson_events table (Dex) |
| `00a975b` | `fix(admin)`: lessons require a video upload — remove text-only escape hatch (Iris) |
| `35df61f` | `feat(admin)`: mobile-first layout — Sheet nav drawer + flex-col stacking (Iris) |
| `facfae7` | `feat(admin)`: members, analytics, overview polished to new design language (Iris) |
| `8f89aff` | `feat(admin)`: clients surface redesign + new-from-client lesson assignment (Iris, closes Dex's workflow gap #16) |
| `73dbcdc` | `feat(admin)`: lesson detail page redesign + Delete-lesson UI (Iris) |
| `101b243` | `feat(admin)`: introduce UI primitives + redesigned lesson-create flow (Iris) |
| `16b999c` | `feat(auth)`: log magic-link URL behind DEV_LOG_MAGIC_LINKS env gate (Dex) |
| `90da9d9` | `feat(admin)`: close five gaps — lesson edit, reorder, members, employee surface, timeline (Dex) |
| `a0937c1` | `feat`: unified employee experience + 30-day store re-confirm + critical fixes (Dex) |
| `f8009c3` | `docs`: refresh spec + CLAUDE.md for current stack and pre-prod workflow (Dex) |

## What's pending / blocked

### Operator action (Dimi)
- **ImageKit credentials on Railway env.** `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT`. Until these are set, the upload endpoint returns 503 and image/carousel uploads can't go end-to-end. Video lessons unaffected. Dex offered two paths: A) Dimi creates a shared Pandas ImageKit account + pastes the keys; B) Dex provisions on Dimi's behalf. Decision pending.

### Just shipped (during this handoff write-up)
- ✅ `50c9506` — analytics + browse + admin clients detail now read completion from `lesson_events` instead of `lesson_completions`. Rating data still sourced from `lesson_completions` (decoupled the two signals — see commit body). Backfill ran in migration `0001_media_types_and_events.sql` so historical counts are preserved.
- ✅ Same commit: `/api/lessons/[id]/complete` (RatingWidget endpoint) now ALSO fires a `rating_submitted` lesson_event best-effort alongside the existing `lesson_completions` row write. Events table carries the rating signal for analytics; `lesson_completions` stays for back-compat.
- ✅ Same commit: `/browse` is now content-type-aware — image lessons show `imageUrl` as thumbnail, carousel lessons show the first slide. Old "thumbnail !== null" filter would have hidden every non-video lesson.

### Deferred (acknowledged, not done)
- **TranslationsManager and StoresManager internal polish** — they live inside the new Cards but their innards still use older styling. Functional but visually inherit from the previous era. Low priority.
- **The ~13 missing workflows from the consolidated inventory** — each is a feature pass, not polish: Mux upload error recovery, preview-as-employee, drill into individual employee history, promote/demote/move user, force a user through re-onboarding, magic-link/session admin actions, bulk ops, search/filter on long lists, audit log of admin actions, scheduled publish, CSV export, translation fallback config.
- **Per-lesson dwell-time override for image lessons** — hardcoded to 5s globally. Dex flagged a column-on-lessons approach. Not implemented yet.
- **Rating model** — staying at 1–5 stars. Migration to thumbs up/down deferred until Dimi decides.
- **Comments feature** — TikTok-style comments on lessons. Deferred entirely pending decision on comments vs feedback vs questions.
- **`updateImageLesson` / `updateCarouselLesson`** — admins can create image/carousel lessons but the detail page editor for swapping the image / reordering slides post-create isn't built yet. Mux/Translations editor already handles video.

## Conventions Iris uses

### Design language source-of-truth
- `src/app/globals.css` `@theme` carries the tokens — brand emerald `#10B981` is reserved as the affirmative accent (active / published / engagement-bar). Signal colors per intent: green/amber/red. Geist Sans canonical. Sane `:focus-visible` ring. Honors `prefers-reduced-motion` globally.
- Surfaces are zinc neutrals on `bg-zinc-50` with white cards (`border-zinc-200`, `rounded-lg`, no shadow unless intentional). Restraint over expression — Linear/Stripe-dashboard reference.
- Internal admin is functional first; the employee Reels shell is the brand-expression surface.

### UI primitives discipline
- Compose, don't sprawl. New surfaces use `src/components/ui/*` primitives — Button, Dialog, Input, Label, Textarea, Select, Switch, Card, Badge, EmptyState, PageHeader, Sheet, Toaster. If a pattern repeats 3+ times, lift it.
- Use Radix under the hood for anything that needs real a11y (Dialog, Select, Switch, Sheet). No `npx shadcn add`; primitives are hand-pulled and shaped to the Dojo language.
- Class composition via `cn()` (`src/lib/cn.ts`) — `clsx + tailwind-merge` so conflicting classes (`text-red-500 text-blue-500`) resolve cleanly.
- Sonner for toasts; toaster mounted at the admin layout root. Use `toast.success` / `toast.error` for feedback after server actions; never inline error strings in the UI.
- Icons via lucide-react. Consistent sizes (`h-3.5 w-3.5` inline, `h-4 w-4` button-leading, `h-5 w-5` for empty-state circle).

### Frontend ship pattern
- Same direct-to-main flow as Dex; same explicit-staging discipline (don't `git add -A` — filemode flips on this filesystem and you'll bundle 100+ no-op changes; stage paths explicitly). Verified the hard way mid-session.
- Always `tsc --noEmit` clean before commit. The Dialog primitive's transition utilities don't depend on `tw-animate-css`; they use inline `data-[state=open]:` CSS classes that work with v4 out of the box.
- New dependencies are best-in-class only and worth documenting in the commit body (Radix subsets, react-dropzone, sonner, lucide-react, clsx + tailwind-merge — all pulled in the V1 pass).

### Visual + mobile QA loop
- Headless playwright against the LIVE deploy, not a local dev server. Auth via `/tmp/dojo-login.sh <email> <cookie-jar>` (uses Dex's dev magic-link log gate).
- Playwright + chromium-headless-shell at `/tmp/iris-pw/`. Two scripts: `shoot.mjs` (desktop 1440x900) and `shoot-mobile.mjs` (390x844 iPhone-ish, isMobile + hasTouch). Both load the cookie jar from `/tmp/dojo-admin-cookies.txt`.
- For mobile-drawer-open / dialog-open / hover states, write a short interaction script (see `shoot-menu-open.mjs` as the pattern — click + waitForTimeout + screenshot).
- VPS has no X server — chrome-devtools MCP can't launch a visible Chrome. Headless shell is the path; pinch-zoomable screenshots cover the visual diff need.

### Lessons assumed but not always stated
- The admin layout (Sheet drawer + flex-col on mobile) and Dialog primitive (capped width on mobile) are the load-bearing pieces of spec §1.1 (mobile-first). Don't regress them.
- Tables inside `overflow-x-auto` inside a `rounded-lg overflow-hidden` Card — the outer overflow-hidden preserves the rounded corners; the inner scroll lets wide tables breathe on small viewports without breaking page layout.
- Status pills are Badges, not bespoke inline spans. If you find yourself writing `<span className="rounded-full px-2 py-0.5 …">`, use Badge instead.

## Conventions Dex uses

### Backend ship pattern
- Direct commits to `main`, no PRs while pre-prod (`/apps/dojo/CLAUDE.md`).
- Always `tsc --noEmit` clean before commit. Don't trust the build catching things later — the Railway build is reactive, not diagnostic.
- Don't `git add -A` — git tracks filemode on this repo and the persona's filesystem flips exec bits constantly. Stage explicit paths, or pass `-c core.fileMode=false` to `git add` / `git commit` / `git diff` when you must operate at scale. Never modify the persistent gitconfig.
- Migrations: `DATABASE_URL=<DATABASE_PUBLIC_URL from Railway> npx drizzle-kit generate --name <slug>`. Migrations land in `drizzle/`, auto-run on deploy via the `release` startCommand in `railway.json` (`npm run db:migrate && npm run db:seed && npm run start`).
- Drizzle migrations should be additive when possible. If you absolutely need a data backfill, append it as an idempotent INSERT inside the same .sql so re-runs are safe (see `drizzle/0001_media_types_and_events.sql` for the pattern).

### Railway operations
- Don't use the railway CLI — my account token is rejected. Always go via the GraphQL API at `https://backboard.railway.com/graphql/v2` with `Authorization: Bearer $RAILWAY_TOKEN` from `/personas/dex/.env`.
- Dojo project + service IDs are stable: project `e0bf2e2d-cd72-47ab-85a8-7286d8972198`, env `f6e41437-0cd1-442e-8dd5-3d4b540930f0`, web `f6de1fcf-07ee-4144-9f78-4d45ce293f0d`, Postgres `5fc74ee4-8f0c-486c-824e-8742815fa168`.
- Set env vars via the `variableUpsert` mutation. Trigger a redeploy with `deploymentRedeploy(id: <previous deployment id>)`. Status polls via `deployments(first: 1, …)` then `deployment(id: …) { status }` — terminal states are `SUCCESS` / `FAILED` / `CRASHED` / `REMOVED`.
- `deploymentLogs` shows runtime stdout (typically a propagation lag of 15–30s after a request fires). `buildLogs` shows the Nixpacks build. `environmentLogs` is more reliable for fresh runtime stdout — Iris's `/tmp/dojo-login.sh` uses it for the magic-link gate.
- The Postgres `DATABASE_PUBLIC_URL` is the TCP-proxy host (`yamanote.proxy.rlwy.net:<port>`); the internal URL `postgres.railway.internal:5432` only resolves from inside the same Railway project. Use the public URL for local migrations + DB inspection from the VPS.

### Auth.js v5 specifics
- Two configs by design: `src/lib/auth.config.ts` is the Edge-safe slim slice used by middleware; `src/lib/auth.ts` is the full Node config with the Drizzle adapter + Resend provider.
- Middleware reads claims off the JWT only. It can't touch the DB. JWT self-heal lives in the full config's `jwt` callback — only re-derives role/clientId when the row looks genuinely stale (admin with non-null clientId, or non-admin with null clientId) to keep the request path off Postgres.
- After mutating a user record server-side, call `unstable_update({ user: { … } })` to force Auth.js to re-issue the JWT — middleware sees the fresh claims on the very next request without a sign-out/sign-in round trip.

### Tracking pattern (`useLessonTracking`)
- Hook is the single source of truth for client-side event emission. Components consume it; nobody calls `/api/lessons/[id]/event` directly.
- Engagement heuristic mirrors the `pandas-dynamic-lander` landing-page tracker — visible AND (active in last 30s OR a video is currently playing). Final heartbeat fires via `navigator.sendBeacon` on `pagehide`/`visibilitychange-hidden` so a tab close doesn't lose the count.
- All event POSTs are fire-and-forget — the tracker must never block or break the UI. If a write fails, the events table is missing that one row; the lesson keeps playing.
- Server-side `scopedDb.events.write` de-dupes `lesson_opened` and `lesson_completed` per `(user_id, lesson_id)` so retries are safe. `lesson_engagement` and `rating_submitted` always insert.

### Tenant-scoping discipline
- `scopedDb(user)` is the only path for employee-facing reads/writes against tenant tables. The integration test (`src/tests/tenant-isolation.test.ts`) fails the build if anyone reaches `db` directly for tenant data.
- Admin routes use the raw `db` client but self-authorize at the top of each handler with `if (session.user.role !== 'admin') return 403`. Never rely on middleware redirects for authorization — middleware redirects; it does not authorize.
- The denormalised `client_id` on `lesson_events` is set server-side at write time from the user's clientId — never accepted from the client payload. Analytics queries scope by it.

### Migration-state cleanup
- The `MuxPlayerClient.tsx` legacy component was removed in `f1ea6b9` as part of the three-content-type viewer split. If anyone needs a Mux player going forward, it lives in `VideoLessonViewer`.
- `createLesson` (the legacy action that creates a video-less lesson with just title+description) is still exported but unused — the New Lesson dialog routes through `createLessonFromUpload` / `createImageLesson` / `createCarouselLesson` exclusively. Safe to delete in a future cleanup pass.

## Reading order for a fresh session

1. `/apps/dojo/CLAUDE.md` — hard rules, workflow stance
2. **This file** — current state of play
3. `docs/spec.md` — product spec
4. `docs/architecture.md` — code layout + tenant scoping pattern
5. `docs/decisions.md` — running ADR
6. `docs/deploy.md` — Railway, env vars, webhooks

## Telegram coordination (multi-bot discipline)

- Both Iris and Dex receive every message in the dojo Telegram group; they coordinate via that channel.
- When Dimi names ONE persona (e.g. "Dex, …"), the other stays silent.
- For acks/back-and-forth between agents that doesn't carry new info, stay silent — it reads as bot noise to Dimi.
- ANNOUNCE / DONE on substantive work. UPDATE only when materially over the original ETA.
- See Iris's persona memory `feedback-message-volume-discipline` + `feedback-multi-bot-group-discipline` for the lock.
