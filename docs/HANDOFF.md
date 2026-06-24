# Dojo — Handoff (2026-06-24)

> Source-of-truth snapshot for picking up Dojo cold. Updated when scope shifts.
> Read this first; then `spec.md`, `architecture.md`, `decisions.md`, `deploy.md`.

## First 10 minutes (cold-start playbook)

If you've been dropped into Dojo with no prior context, do these in order:

1. **Read `/apps/dojo/CLAUDE.md`** — hard rules, lane split, workflow stance. Less than 2 minutes.
2. **Read this file end-to-end.** Don't skip — every section earned its keep.
3. **Skim `docs/spec.md`** for the product story; `docs/architecture.md` for the code map; `docs/decisions.md` for ADR-level "why we did X." `docs/deploy.md` only when you need to touch Railway.
4. **Pull the latest:** `cd /apps/dojo && git fetch origin && git log --oneline -20`. Check the "Recent commits" table here against what's on `main` — if git is ahead, this doc is stale and the fresh commits are truth.
5. **For visual work (Iris):** Source `/personas/iris/.env`. Run `/tmp/dojo-login.sh dimitris@pandas.io /tmp/dojo-admin-cookies.txt` to grab a fresh admin cookie via the dev magic-link gate. Then `cd /tmp/iris-pw && node shoot.mjs …` to screenshot.
6. **For backend work (Dex):** Source `/personas/dex/.env`. Verify `RAILWAY_TOKEN` works with a no-op GraphQL ping. Then read `src/lib/db/schema.ts` to ground in the current data shape. Note `/tmp/dex-pw/` exists for Dex-side playwright + postgres scripts (separate from Iris's `/tmp/iris-pw/` — see "Shared-worktree discipline" below).
7. **Don't start ad-hoc work — wait for the user prompt or read the Telegram thread.** The dojo group ID is `-5267432337`; Dimi is `user_id="1886796381"`, Dex is `8474592678`. Voice notes arrive as `attachment_kind="voice"` — transcribe with `ops-listen` (Whisper HTTP API), treat the transcript as if Dimi typed it.

## What Dojo is

**Dojo is the internal training portal for retail employees of our clients.** A new client signs Pandas → their store employees need to learn the platform (Vision AI assessments, trade-in flows, etc.) → Dojo is how we train them at scale without sending a person on-site.

- **Audience:** retail employees of telco operators, retailers, and Apple Premium Partners — many are on mobile, in-store, between customers.
- **Format:** short content lessons delivered Instagram-Reels / TikTok-style. Vertical, full-bleed, swipe-to-next.
- **Mobile-first is a hard constraint** (spec §1.1). Most employees view on mobile.
- **Whitelisted email domains only.** No passwords. Magic-link sign-in via Resend. Per-client domain allowlist.
- **Eventual domain:** `learn.pandas.io`. Currently `web-s2cr-production.up.railway.app`.

## Status as of 2026-06-24

**Pre-production.** Still. Same workflow stance: direct commits to `main`, no PR review gate, no `develop` branch — this lapses when real client employees come online (`/apps/dojo/CLAUDE.md`).

**Big lifts shipped in the 2026-06-24 session** (Iris-led, Dex providing backend on three sub-deliveries):

- **`/browse` dark redesign + tier hero card + tap-to-open tier modal.** The library is now the brand-expression surface alongside Reels — black, centered title, horizontal-scroll rails of 4:5 portrait cards. Hero card pinned ABOVE the title shows "You are ⚡ Specialist · 2 lessons to Expert" in one line. Tap → centered modal with the tier ladder stacked vertically (highest tier on top, current tier ringed with a "YOU" badge + the user's initial, "X ahead of you" on tiers above, "Completed" pill on tiers below). Counts are CLIENT-WIDE (not store-level — explicitly rejected by Dimi). "X ahead of you" hides entirely when zero. The whole tier system is data-driven via the new `lesson_tiers` table + `/admin/tiers` page (see below).
- **Floating bottom nav** (Instagram-style pill, dark, rounded-full, safe-area-inset-bottom). Four tabs: 🏠 Library / ▶ Reels / 🔖 Saved / Avatar (your email's first letter). Active tab gets a horizontally-stretched pill highlight. Reels link is computed PER-PAGE to point straight at `/watch/[firstIncompleteId]` so navigation is single-hop (no `/watch` redirect double-flash). Nav is hidden on `/watch/[id]` for full Reels immersion — back chevron is the only way out.
- **New routes:**
  - `/saved` — bookmarked lessons in a 2-col vertical grid (no groups, no horizontal scroll). Same card visuals as `/browse`.
  - `/profile` — email (read-only), language + store change (server actions, JWT re-issue via `unstable_update`), and the sign-out button moved here from `/browse` top-right. Avatar tile up top.
  - `/watch` (no id) — server-side redirect that picks the first-incomplete-by-sort-order lesson. Still useful for direct-URL access; the bottom nav itself skips it.
- **Productized tier system** (Dex backend, Iris UI rewire). `lesson_tiers` table, `/admin/tiers` CRUD + reorder + threshold edit, `getBrowseTierData` read shape that the hero card consumes. Tier count / names / emojis / thresholds are all editable in data without a deploy. Seeded with the original 3 (🌱 Apprentice / ⚡ Specialist / 🏆 Expert) as the global default. Defensive fallback if the table is empty/unreachable. Legacy `src/lib/tier.ts` deleted on the rewire.
- **Dynamic "New lessons" rail** (Dex backend). Per-user high-water mark (`users.last_new_lessons_checked_at`) + per-lesson publish moment (`lessons.published_at`). `getBrowseData` returns a separate `newRail` field when there's anything published since the user's last check; Iris's `/browse` renders it at the very top above the editorial groups. Lessons in `newRail` also stay in their normal group (so totals/tier-progress/reels count each once). Checkpoint bumped to now on each render.
- **Lesson groups + bookmarks** (Dex backend, Iris UI). Earlier in the session — `lesson_groups` table, `lessons.group_id` + `lessons.group_sort_order`, `lesson_bookmarks` (PK `user_id+lesson_id`), `toggleBookmark` server action, `/admin/lesson-groups` page. Bookmark toggle is the icon at the bottom-right of every card (white when off, red filled when saved). Backs the entire dark `/browse` rail layout.
- **Test fixture seed (one-off).** `src/scripts/seed-browse-fixtures.ts` — idempotent script that created 5 editorial groups (Managing the store · Customer flows · Vision AI basics · Trade-in process · Repair workflows) with 24 new lessons reusing the existing 7 lessons' media so cards render real posters. Total now: 6 rails / 31 lessons on Orange Belgium.

**Visual hygiene tweaks made in-session** (worth noting for future styling):
- Card aspect 4:5 (Instagram portrait).
- Card width mobile: `w-[38vw]` max 200px → roughly 2.33 cards per row with peek. Desktop: `sm:w-44 md:w-48 lg:w-52`.
- Card radius: `rounded-lg` (8px).
- Card gap: `gap-2` mobile / `sm:gap-3` desktop (8px / 12px).
- Play badge centered on video cards only; image + carousel cards stay clean.
- Tier modal row colors are POSITIONAL (first tier = amber/warm, top tier = emerald/brand, middle tiers = sky) — so any N-tier ladder reads cleanly without per-tier-name styling.

**Library view (Layout 2) — `/browse`** is no longer "untouched" — see "Library view" section below for the full description.

**Live URL:** https://web-s2cr-production.up.railway.app
**Login:**
- Admin: `dimitris@pandas.io` (in `ADMIN_ALLOWLIST` env var)
- Employee (Orange Belgium seed): `dimitris@parallel9.com` (in `parallel9.com` allowed domain)

**Dev magic-link URL gate:** `DEV_LOG_MAGIC_LINKS=1` is set on Railway. The magic link URL is logged to `environmentLogs` ~15s after a sign-in trigger. Pull via the Railway GraphQL API at `https://backboard.railway.com/graphql/v2` with `Authorization: Bearer $RAILWAY_API_TOKEN` (account-scoped from `/personas/iris/.env`).

---

## Earlier — Status as of 2026-06-03

**Pre-production.** No external client employees are using it yet; the public Railway URL is internal-only. Optimised for speed of iteration — direct commits to `main`, no PR review gate, no `develop` branch. This rule lapses when real client employees come online (spec'd in `/apps/dojo/CLAUDE.md`).

**Big lifts shipped in the 2026-06-03 session:**
- **Reels view (Layout 1)** — `/watch/[id]` is now a full-bleed Instagram-Reels feed: all assigned lessons stacked in one CSS scroll-snap container, swipe-with-momentum between lessons, autoplay-muted with tap-for-sound, persistent back chevron top-left, fading bottom title-description overlay, object-contain everywhere so 9:16 / 1:1 / 16:9 all render at native aspect. Rating widget pulled entirely (placement TBD).
- **Library view (Layout 2)** — `/browse` is **untouched** by this session. It's still the pre-Reels card layout. Real client employees would land on `/browse` first; this is the largest outstanding UI lift for the user-facing surface.
- **Admin batch (8 items shipped, 5 skipped, 1 deferred — original 14 from 2026-06-02 list)** — full audit log, employee drill page, Mux error recovery, resend magic link, bulk ops, preview-as-employee, translation fallback rule, auto re-onboarding triggers. Analytics-exclude-admins shipped alongside as a write-time filter. See "Workflow inventory" below for the full resolution.
- **Real content seed** — 7 placeholder lessons (3 videos at 9:16, 2 single images, 2 carousels) assigned to Orange Belgium. Old demo lessons deleted + seed.ts updated so they don't re-spawn on deploy.

**Live URL:** https://web-s2cr-production.up.railway.app
**Login:**
- Admin: `dimitris@pandas.io` (in `ADMIN_ALLOWLIST` env var)
- Employee (Orange Belgium seed): `dimitris@parallel9.com` (in `parallel9.com` allowed domain)

**Dev magic-link URL gate:** `DEV_LOG_MAGIC_LINKS=1` is set on Railway. The magic link URL is logged to `environmentLogs` ~15s after a sign-in trigger. Pull it via the Railway GraphQL API:
```
POST https://backboard.railway.com/graphql/v2  Authorization: Bearer $RAILWAY_API_TOKEN
{ environmentLogs(environmentId: "f6e41437-0cd1-442e-8dd5-3d4b540930f0", beforeLimit: 50, filter: "DEV_MAGIC_LINK email=<addr>") { timestamp message } }
```
Helper script at `/tmp/dojo-login.sh` automates this. Flip the env var off when going live.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 App Router | Server Components by default |
| Language | TypeScript strict | |
| Styling | Tailwind v4 | Tokens in `src/app/globals.css` `@theme`. UI primitives at `src/components/ui/`. |
| Database | Postgres on Railway | `DATABASE_URL` from Railway reference var. Public TCP-proxy URL via `DATABASE_PUBLIC_URL`. |
| ORM | Drizzle | Schema at `src/lib/db/schema.ts`. Migrations in `drizzle/` auto-run on deploy via the `release` startCommand. |
| Auth | Auth.js v5 + Resend | Magic-link, JWT sessions, sender `noreply@mkt.pandas.io`. JWT callback in `src/lib/auth.ts` self-heals role/clientId + runs the auto-reonboarding check. |
| Video | Mux | Direct-upload from browser; webhook signature-verified at `/api/webhooks/mux`. Webhook captures `aspect_ratio` + asset.errored messages. |
| Images | Railway Bucket (Tigris, S3-compatible) | `dojo-media` bucket. Server-proxied upload at `/api/admin/lessons/upload-image` reads dimensions via `image-size`. Public read via `/api/media/[...path]` proxy stream. Bucket has no public URL. |
| Tests | Vitest | Integration tests for auth, tenant isolation, Mux webhook |
| Deploy | Railway | Web + Postgres in one project. Project `e0bf2e2d-cd72-47ab-85a8-7286d8972198`, env `f6e41437-0cd1-442e-8dd5-3d4b540930f0`, web `f6de1fcf-07ee-4144-9f78-4d45ce293f0d`, Postgres `5fc74ee4-8f0c-486c-824e-8742815fa168`, bucket `78b9a5f1-b727-41af-86b7-d93349541f1b`. |

## Architecture invariants (non-negotiable)

1. **App-layer tenant scoping.** Every employee-facing query goes through `src/lib/db/scoped.ts → scopedDb(user)`. Never touch a tenant table without it. Integration test fails the build if bypassed.
2. **Admin write routes self-authorize.** `session.user.role === 'admin'` checked server-side, not just in middleware.
3. **Mux webhook signature.** Verified with `MUX_WEBHOOK_SECRET` (HMAC-SHA256) before doing anything with the payload.
4. **No `--no-verify`, no `--force main`.** Fix the underlying issue.
5. **Admin writes audit-log.** Every admin server action calls `writeAuditEntry()` from `src/lib/audit-log.ts` on the success path. Action vocabulary documented inline in that file — extend it as new actions ship.
6. **Analytics exclude admins.** `/api/lessons/[id]/event` silently no-ops when `session.user.role === "admin"` — Pandas-team dogfooding doesn't pollute client funnels. Preview-mode viewing also has no session, so no events fire either.

## Data model snapshot (post-2026-06-03)

Migrations to date: `0000_init.sql`, `0001_media_types_and_events.sql`, `0002_admin_audit_log.sql`, `0003_mux_error_message.sql`, `0004_aspect_ratio.sql`, `0005_lesson_groups_and_bookmarks.sql`, `0006_lesson_tiers.sql`, `0007_new_lessons_rail.sql`. All additive; the `release` startCommand runs them on every deploy.

Tables (lesson surface):

- `lessons` — `id, internal_name, type ('training'|'announcement'|'update'), content_type ('video'|'image'|'carousel'), sort_order, group_id (FK → lesson_groups, nullable, ON DELETE SET NULL), group_sort_order, is_published, published_at (set on first publish, backfilled = created_at), created_at`.
- `lesson_groups` — editorial sections shown on `/browse`. `id, name, sort_order, created_at`. Global (not per-client) — assignment to a client happens via the lessons that belong to the group + `client_lessons`. Admin at `/admin/lesson-groups`.
- `lesson_bookmarks` — per-user save. PK `(user_id, lesson_id)`. Toggle via `scopedDb.bookmarks.toggle(lessonId)` server-side; consumed in `/browse` cards + `/saved` page.
- `lesson_tiers` — productized gamification ladder. `id, client_id NULLABLE (NULL = global), name, emoji, min_pct (0..1 fraction of completed/assigned), sort_order, is_active, timestamps`. Seeded with the original 3 (🌱 / ⚡ / 🏆) as global default. Admin at `/admin/tiers`.
- `users` adds `last_new_lessons_checked_at timestamptz` — per-user high-water mark for the dynamic "New lessons" rail. Bumped to now on each `/browse` render.
- `lesson_translations` — `(lesson_id, language)` unique; carries per-language `title, description, notes_markdown`. Plus media + media-shape columns:
  - Video: `mux_playback_id, mux_asset_id, mux_upload_id, duration_seconds, thumbnail_url, mux_error_message` (set from `video.asset.errored` webhook or `resyncMuxUpload`).
  - Image: `image_url, image_alt`.
  - Carousel: `carousel_slides jsonb` — ordered `[{url, alt, caption?}, ...]`.
  - All types: `aspect_ratio real` — width/height (1.7778 for 16:9, 0.5625 for 9:16, 1.0 square). Populated at upload time (image header parse via `image-size`, Mux webhook for video). Nullable for legacy rows.
- `client_lessons` — junction (which clients see which lessons).
- `lesson_completions` — kept for legacy rating data (`rating int`, 1–5). Completion status is computed from `lesson_events`, NOT from "row exists in this table." Historical rating rows were backfilled into `lesson_events` as `lesson_completed` so analytics history doesn't disappear.
- `lesson_events` — append-only event log. Types: `lesson_opened`, `lesson_completed`, `lesson_engagement`, `rating_submitted`. Payload is jsonb. Writes from admin-role users are silently skipped.
- `admin_audit_log` — append-only record of every admin write. `actor_user_id, action (namespaced verb), target_type, target_id, payload jsonb, created_at`. Three indexes — actor+created, target_type+target_id+created, action+created — cover the realistic read patterns. Read via `getAuditLog()` helper in `src/lib/audit-log.ts`; admin viewer page at `/admin/audit-log`.
- `users, clients, client_allowed_domains, client_languages, stores, accounts, sessions, verificationTokens` — Auth.js + tenant infra.

## Three content types

| Content type | Authoring | Reels viewer | Completion criteria |
|---|---|---|---|
| **Video** | Drag-drop file → Mux direct-upload → webhook fills `mux_playback_id` + aspect | `VideoLessonViewer` (Mux player) | 90% of duration watched |
| **Image** | Drag-drop one image → server proxy → `dojo-media` bucket → `/api/media/lessons/<uuid>.<ext>` | `ImageLessonViewer` | 5 seconds of visible dwell |
| **Carousel** | Drag-drop multiple images → sequential bucket uploads → ordered slide list with alt + caption | `CarouselLessonViewer` | All slides viewed (TikTok-style horizontal swipe) |

Text-only lessons are explicitly out of scope. Use a carousel of designed image-slides for text content.

Each translation row has `aspect_ratio` populated at upload time. The Reels feed uses object-contain so a 1:1 image on a 9:16 phone letterboxes top/bottom rather than cropping.

## Event model

Four event types, content-type-dependent triggers:

- `lesson_opened` — auto-fires on mount of the viewer (server dedupes per `(user_id, lesson_id)`).
- `lesson_completed` — caller decides per content-type rules (above).
- `lesson_engagement` — 15s heartbeats with cumulative `engagedMs`. "Engaged" = visible AND (active in last 30s OR a video is currently playing). Final heartbeat on hook cleanup, `pagehide`, or `visibilitychange-hidden` via `sendBeacon`. Server analytics use `MAX(engagedMs) per lesson` because heartbeats are cumulative.
- `rating_submitted` — separate from completion. Rating stays 1–5 stars for now (thumbs migration deferred).

The hook is `src/lib/useLessonTracking.ts`. Returns `{ emitOpened, emitCompleted, emitRating }`. Honours an `enabled` flag (gated by the Reels feed's active-lesson state — see below) and a `disableTracking` flag (gated for preview surfaces).

## Reels view (Layout 1) — `/watch/[id]`

**The brand-expression surface.** Built 2026-06-03 to feel exactly like Instagram Reels / TikTok.

Behaviour:
- **Feed model.** `ReelsFeed.tsx` renders ALL assigned lessons in one fixed-position container (`100dvh × 100vw`). Each lesson is a `<section>` with `height: 100dvh`, snap-aligned via `snap-y snap-mandatory`. Native browser scroll-snap drives the swipe — finger genuinely controls position, releases snap cleanly.
- **Active-lesson gating.** An `IntersectionObserver` picks the section with ≥60% visibility as `activeIndex`. Only the active viewer autoplays + emits tracking events. Inactive viewers stay mounted (so swipe-in is instant) but paused and silent. Each viewer takes `active` + `disableTracking` props; the tracker hook respects `enabled = !disableTracking && active`. Verified live with playwright trace: every engagement event matches the lesson active at that moment, zero misfires.
- **URL syncs to the active lesson** via `history.replaceState` — back / share works on a specific lesson.
- **Persistent back chevron** top-left (`ChevronLeft`, drop-shadow for readability over light scenes, never fades).
- **Fading bottom overlay** (3s timeout, fades back on tap) — gradient transparent→black, title in bold + description after a `·` separator. Truncates cleanly on small viewports.
- **Tap toggles overlay visibility.** Tap on the player toggles play/pause via Mux Player's own controls.
- **Video autoplay muted** (browser policy). "Tap for sound" hint auto-fades. Unmute button bottom-right (active lesson only).
- **Carousels swipe horizontally** within their lesson section — TikTok pattern. Bottom-center dot indicators with varying-size pulses; `N / total` pill top-right.
- **`object-fit: contain` on every viewer** — 9:16 fills flush, 1:1 letterboxes top/bottom with the section's black background, 16:9 letterboxes top/bottom. Mux Player honors `--media-object-fit: contain` via inline style.
- **Keyboard nav:** ↑/↓ / PageUp/PageDown / Space = prev/next; Esc = back to `/browse`. Desktop-only side arrow buttons mid-right.
- **No rating widget.** Pulled entirely in this pass. Placement is a known gap (see "Pending").
- **No sign-out / no top nav bar** — just the persistent back chevron.

Wrong-shaped lessons (preferred language exists but media is missing) silently fall back to English via the media-aware rule in `scopedDb.translations.forLesson` / `forLessons`. Only fires a "not ready" banner if even English has no media — true edge case.

## Library view (Layout 2) — `/browse`

**The brand-expression surface alongside Reels.** Built 2026-06-23 → 2026-06-24.

Layout (top to bottom):
1. **Tier hero card** (above the title). One line: `You are [emoji] {Tier} · X lessons to {NextTier}` with a chevron-right. Tap → centered tier modal. Drops the chevron and changes the trailing clause to `Top tier reached — N of M complete` once Expert is hit.
2. **`Lesson library` title** — centered, big, bold.
3. **Dynamic "New lessons" rail** (when there's anything new for this user) — sits above the editorial groups.
4. **Editorial group rails** — one per `lesson_groups` row (in `sort_order`), then a trailing "More lessons" bucket for ungrouped lessons.
5. **Floating bottom nav** — pinned, see below.

Card mechanics:
- 4:5 portrait, `rounded-lg` (8px), object-cover poster. Mobile width `w-[38vw]` (max 200px) → ~2.33 cards per row with a peek. Desktop scales down to `sm:w-44 / md:w-48 / lg:w-52`.
- Horizontal scroll-snap mandatory per rail, scroll-pl matched to outer padding, scrollbar hidden.
- Per-content-type cues on the card:
  - **Video** — centered translucent white play badge with backdrop-blur. Image and carousel cards stay clean (no center overlay).
  - **Completed** — small emerald "Done" pill top-left.
- **Bookmark button** — bottom-right of every card. White outline when off, red filled when saved. Tap = optimistic toggle, `e.stopPropagation()` so it doesn't follow the card's link.
- Tap a card → `/watch/[id]` (the Reels view).
- Wrong-shape / processing / no-preview lessons stay mounted with `opacity-60` and no link (consistent with Reels handling).

### Tier hero card + modal

- The hero card itself is one text line + chevron. Drop the surrounding chrome and emoji avatar tile that an earlier iteration had (small footprint won).
- Modal (Radix Dialog, dark) renders the active ladder VERTICALLY, highest tier on top (Expert → Specialist → Apprentice for the seeded 3). Each row carries the tier emoji, name, and:
  - **Your tier:** ring + "YOU" badge + your email's first letter as an avatar + `X lessons to {NextTier}` callout (or `Top tier reached` at the top).
  - **Tiers above you:** `count ahead / of you` count text, **hidden entirely when count is 0**.
  - **Tiers below you:** emerald `✓ Completed` pill.
- Row colors are POSITIONAL: index 0 = amber/warm, index N-1 = emerald/brand, middle = sky. Adapts cleanly if an admin adds a 4th or 5th tier in `/admin/tiers`.
- Below the tier stack: per-group progress (`2 of 4 in Managing the store`) with mini progress bars.
- The whole modal consumes `getBrowseTierData({ clientId, completed })` from `src/lib/tiers-data.ts`. Counts are CLIENT-WIDE (not store-level). Tier definition reads from `lesson_tiers`; falls back to the hardcoded 3 if the table is empty/unreachable.

### Dynamic "New lessons" rail

- Returned as a separate `BrowseData.newRail` field (not inside `groups[]`) so totals + tier-progress count each lesson once.
- Iris's `/browse` renders it first when present, then maps the editorial groups.
- Threshold = `users.last_new_lessons_checked_at`. Bumped to now on each `/browse` render (best-effort, fire-and-forget). Once you see the rail, it stays empty until something else is published.
- `lessons.published_at` is the per-lesson timestamp — set on `is_published` false→true; backfilled to `created_at` for existing rows.
- Title: `New lessons`. Per-card "NEW" badge / per-rail visual treatment deferred (Iris's lane when called).

## Bottom navigation — `src/components/BottomNav.tsx`

Instagram-style floating pill at the bottom of every employee surface EXCEPT `/watch/[id]` (immersion). Four slots:

- 🏠 **Library** → `/browse`
- ▶ **Reels** → `/watch/[firstIncompleteLessonId]` — href is computed per-page (each consuming page passes `reelsHref`) so navigation is single-hop. The `/watch` (no id) redirect helper still exists for direct-URL access but the nav skips it.
- 🔖 **Saved** → `/saved`
- **Avatar** → `/profile` — the user's email-first-letter inside a white circle. Active state ring.

Mechanics:
- `fixed inset-x-0 bottom-0` with `safe-area-inset-bottom` padding for iOS.
- `bg-zinc-900/95 ring-1 ring-white/10 rounded-full px-2.5 py-2`. `overlay` prop swaps in `bg-zinc-900/80 backdrop-blur-md` for video-bearing surfaces (currently unused since `/watch/[id]` doesn't mount the nav — kept for future).
- Each tab is `h-11 w-16` so the active-state `bg-white/10 rounded-full` reads as a horizontal pill, not a circle.
- Profile slot uses the user's initial (no avatar upload pipeline yet).

## `/saved` — bookmarks page

- 2-column vertical grid (no horizontal scroll, no editorial groups).
- Reuses `shapeBrowseData` to assemble cards, then flattens + filters `card.isBookmarked === true`.
- Cards mirror `/browse` visuals exactly (4:5, play badge on video, completed pill, bookmark toggle bottom-right — tapping the bookmark un-saves and removes the card from the list on next render).
- Empty state with a bookmark icon and copy "Tap the bookmark on any lesson to save it here for later."
- Bottom nav mounted; Reels href computed from the same data.

## `/profile` — settings + sign out

- Avatar tile at the top (user's email first letter), then "Profile" heading.
- Three fields: email (read-only), language `<select>` populated from `client_languages`, store `<select>` populated from the client's `stores` (sorted by name).
- Single "Save changes" button — disabled until either select is dirty. Server actions in `src/app/profile/actions.ts` (`updatePreferredLanguage`, `updateStore`) update the DB + call `unstable_update()` to re-issue the JWT with fresh claims (so middleware and downstream renders pick up the change immediately).
- Sign-out button at the bottom in red treatment. This is the ONLY way out — sign-out removed from `/browse` top-right entirely.
- Toast feedback on save success/failure (Sonner).

## `/watch` (no id) — entry redirect

Server-side: fetches the user's lessons + completed events, picks the first lesson without a completion (or the first lesson if all complete), redirects to `/watch/[id]`. Falls back to `/browse` if no lessons. Used for direct URL access; the bottom nav now points directly at `/watch/[firstIncompleteId]` so the redirect is rarely hit during normal nav.

## Preview-as-employee — `/preview/<token>/...`

Two entry points from admin:
- `/admin/clients/[id]` header: "Preview as employee" button → mints a 24h signed token via `createClientPreviewLink({ clientId })` → opens `/preview/<token>/browse` (the Netflix-grid view AS that client's employee).
- `/admin/lessons/[id]` header: "Preview" button → mints a token via `createLessonPreviewLink({ lessonId })` (auto-resolves to the lesson's first assigned client) → opens `/preview/<token>/watch/<lessonId>`.

Tokens are HMAC-SHA256 over `AUTH_SECRET`, payload `{ clientId, lessonId?, exp }`, 24h TTL. Verification in `src/lib/preview-tokens.ts`. Public middleware exception for `/preview/*` paths so the URL works on an unauthed phone.

Preview surfaces pass `disableTracking={true}` to every viewer. No events fire. Combined with the analytics-exclude-admins write-time block, preview viewing is invisible to client analytics.

`/api/media/*` is also in the middleware public-route allowlist so preview images load on the unauthed phone.

## Admin surface

| Route | Purpose |
|---|---|
| `/admin` | Overview — stat cards (clients/lessons/employees/completions), clients hover-list. |
| `/admin/lessons` | List with status pills, per-translation status dots, reorder, "New lesson" CTA. **Multi-select checkboxes + sticky bulk-ops toolbar** (Publish, Unpublish, Assign to ▾, Unassign from ▾, Delete). |
| `/admin/lessons/[id]` | Metadata · Translations · Assignments · Danger zone. Per-translation video block shows ✓ Ready / ⏳ Processing / ✗ Errored states with content-aware actions (Resync metadata, Clear video, Resync from stuck). |
| `/admin/clients` | Clickable cards with stats. |
| `/admin/clients/[id]` | Details · Allowed domains · Languages · Assigned lessons · Stores (CSV import) · Employees (top 25, links to drill page) · Danger zone. **"Preview as employee" button in header.** |
| `/admin/members` | Admin email allowlist. DB-managed + `ADMIN_ALLOWLIST` env-bootstrap (latter flagged "bootstrap"). |
| `/admin/employees/[userId]` | Per-employee drill (NEW 2026-06-03). Profile card · 5-stat row (Assigned / Opened / Completed / Avg rating / Engaged time) · per-lesson history table. **"Resend magic link" button** in the header (two-click arm pattern to avoid stray double-clicks). |
| `/admin/audit-log` | Filterable table of every admin write (NEW 2026-06-03). When · actor · action · target · payload (expandable). "Load older entries" via `before` cursor. |
| `/admin/analytics`, `/admin/analytics/[clientId]` | Store activation %, trained employees %, avg rating, training funnel, per-store completion, per-lesson breakdown, employee list, 30-day activity timeline. **Reads completion status from `lesson_events`, not `lesson_completions`.** Admin events filtered out at write time — no read-side filter needed. |

UI primitives at `src/components/ui/`: Button, Dialog, Input, Label, Textarea, Select, Switch, Card, Badge, EmptyState, PageHeader, Sheet, Toaster.

Mobile: parent layout `flex-col sm:flex-row`. Top bar with hamburger → Sheet drawer reusing the same nav. Tables in `overflow-x-auto`. Dialog width capped to `calc(100vw-1rem)`.

## Lane split

**Backend (Dex):** DB schema, server actions, API routes, integrations (Mux, Resend, Railway Bucket, Auth.js), validation, business logic, auth, deploys, env, performance.

**Frontend (Iris):** every visible surface — components, layout, motion, styling, user-facing experience.

**Workflow design (Iris drives):** what steps the user takes, in what order, what each screen looks like. Dex surfaces backend constraints DURING the design phase, not after.

**When the lane crosses:** propose the split before doing it. If a backend gap blocks Iris (e.g. she needs an aspect column to do Reels right), Dex ships the backend first, hands the contract over, then Iris consumes. Avoid pulling work from peer to "be helpful" — see "Shared-worktree discipline" + the lane-escalation memory.

## Recent commits (most recent first)

| Commit | What |
|---|---|
| `cd85453` | `feat(browse)`: dynamic 'New lessons' rail at top of /browse (Dex backend + Iris consumer wire) |
| `035a520` | `chore(browse)`: one-off fixture seed (5 groups + 24 lessons reusing existing media) (Dex) |
| `8e68907` | `feat(browse,saved)`: card radius 16→8px (Iris) |
| `787519a` | `feat(browse)`: card gap 12→8px mobile, 16→12px desktop (Iris) |
| `2dc486f` | `feat(browse)`: hide 'X ahead of you' when count is 0 (Iris) |
| `9be32d6` | `feat(browse)`: rewire tier hero card to consume live tier data (Iris) |
| `797b91b` | `feat(tiers)`: productize tier system — `lesson_tiers` + `/admin/tiers` (Dex) |
| `2004858` | `feat(browse)`: collapse hero card to a single line (Iris) |
| `5800fb7` | `feat(browse)`: drop tier bar; 'You are [emoji] Tier' + lessons-to-next (Iris) |
| `c30cbc4` | `fix(reels)`: nav Reels link goes straight to /watch/[id] — kill double-hop flash (Iris) |
| `a467f1e` | `fix(reels)`: black Suspense fallback on /watch — kills the white flash on enter (Iris) |
| `339da11` | `feat(employee)`: BottomNav + /saved + /profile + /watch entry redirect (Iris) |
| `ea09a06` | `feat(nav)`: wider tabs + horizontal pill highlight (Iris) |
| `8211b39` | `feat(browse)`: tighter cards (~2.5/row), play overlay on video, drop metadata row (Iris) |
| `e1499e3` | `feat(browse)`: 'X ahead' on upper tiers + 'Completed' on cleared tiers (Iris) |
| `8294753` | `feat(browse)`: tier hero card above title + tap-to-open modal (mocked) (Iris) |
| `c03ffca` | `feat(browse)`: dark Reels-on-ramp redesign of /browse (Iris) |
| `0452a53` | `feat(browse)`: editorial lesson groups + per-user bookmarks (Dex) |
| `6051dbd` | `feat(admin)`: thread aspectRatio through NewLessonDialog + Resync-metadata link on Ready video state (Dex) |
| `46e72dd` | `feat(reels)`: strip background from back arrow — plain white chevron over the scene (Iris) |
| `38a9ef9` | `feat(carousel)`: TikTok-style horizontal swipe + bottom-center dots (Iris) |
| `9c26b7d` | `fix(reels)`: viewers preserve asset aspect — object-fit: contain everywhere (Iris) |
| `cc2372a` | `fix(reels)`: drop server→client function props that crashed at SSR (Iris) |
| `4daf19e` | `feat(reels)`: swipe-with-momentum feed — all assigned lessons in one scroll-snap stack (Iris) |
| `77d0de1` | `feat(reels)`: swipe up/down + arrow keys navigate to next/prev lesson (Iris) |
| `a1ac5d0` | `feat(reels)`: full-bleed Reels view for /watch — Instagram-Reels behavior (Iris) |
| `aa6d8bf` | `fix(seed)`: drop demo lessons — they kept re-spawning after admin delete (Iris) |
| `11ff7f9` | `feat`: aspect_ratio column on lesson_translations + populate at upload time (Dex) |
| `7c142fd` | `feat(admin)`: preview-as-employee entry points + /preview/<token>/* pages (Iris) |
| `dec19f9` | `feat(admin)`: bulk operations UI on /admin/lessons (Iris) |
| `095179f` | `feat(admin)`: preview-as-employee backend — tokens, data helpers, server actions (Dex) |
| `c59e302` | `feat(admin)`: bulk operations server actions — publish/unpublish/delete/assign/unassign (Dex) |
| `9098c00` | `feat(admin)`: getEmployeeDetail backend + analytics-exclude admins (Dex) |
| `9c6c41a` | `feat(admin)`: Mux error state + Resync action on video translation rows (Iris) |
| `b22d7a5` | `feat(admin)`: Mux upload error recovery — error surface + resync server action (Dex) |
| `73d47ff` | `feat(admin)`: resendMagicLink server action (Dex) |
| `24231d3` | `feat(auth)`: auto re-onboarding triggers on next sign-in (Dex) |
| `943a7b4` | `feat(admin)`: audit log viewer at /admin/audit-log (Iris) |
| `c37fe8b` | `feat(viewer)`: media-aware translation fallback to English (Dex) |
| `3450337` | `feat`: admin_audit_log infrastructure + instrument every existing admin write (Dex) |
| `0a04460` | `feat(admin)`: post-create edit flow for image + carousel lessons (Iris) |
| `2e87b24` | `feat(admin)`: updateImageLesson + updateCarouselLesson + clear/copy mirrors (Dex) |
| `63d1c5d` | `docs(handoff)`: swap ImageKit for Railway Bucket throughout (Dex) |
| `de416c7` | `feat`: swap ImageKit for Railway Bucket (Tigris) for lesson media (Dex) |

(There are several smaller Reels-debug fix commits between `a1ac5d0` and `4daf19e` — overlay rendering quirks under headless playwright vs real browser; consolidated above. Run `git log --oneline -45` for the full picture.)

## What's pending / blocked

### Operator action (Dimi)
- _(empty — no operator-only items pending.)_

### Things that ONLY the operator (Dimi) can do
- Set / rotate / delete Railway env vars on the dojo Railway project (Dex has read access via GraphQL and can `variableUpsert` with a project-scoped token; some bucket operations require account-scoped tokens that sit with Dimi).
- Approve external-facing changes — but dojo is pre-prod so direct-to-main is fine here.
- Domain DNS for `learn.pandas.io` cutover when Dojo goes live (Cloudflare side).
- Add an admin email to `ADMIN_ALLOWLIST` — though you can also add admins from the live Members surface once signed in.

### Deferred (acknowledged, not done)
- **Lesson-in-multiple-groups (Netflix-style cross-tag).** Dimi raised this 2026-06-24 alongside the New-lessons rail. Today `lessons.group_id` is a single nullable FK (1:N). Many-to-many requires a junction table (`lesson_group_assignments`), backfill migration, admin UI for multi-tagging, and read pipeline rewrite. Skipped for now; revisit when content strategy actually needs cross-listing. Dex's lane when greenlit.
- **"New lessons" rail UI badge / per-card "NEW" treatment.** Backend ships the rail; Iris's visual flourish on the rail header + per-card chip is unbuilt. Dimi explicitly said "we can think of it later."
- **Rating placement.** Removed from Reels in the 2026-06-03 polish pass. Real product gap — needs a decision on where it lives (slide-in after lesson complete? on Library? as a separate question after the lesson?) and whether to migrate from 1–5 stars to thumbs. Currently deferred.
- **Avatar upload / display name.** Avatar is the email's first letter for now. Display name not collected at onboarding either — Dimi explicitly accepted this trade-off 2026-06-24 ("we don't need the first name"). When this gets revisited, the change is: add `users.display_name`, onboarding step to collect, profile field to edit, avatar derives initials from it.
- **Onboarding + login dark redesign.** `/onboarding` and `/login` are still functional/light. Employee surface ( `/browse` `/saved` `/profile` `/watch` ) all went dark this session. Closing the loop on the auth flow would unify the surface — not blocking, just pending.
- **Comments / feedback / questions on lessons.** Intentionally deferred pending Dimi's framing decision.
- **TranslationsManager + StoresManager internal polish.** Functional but visually inherit from the previous era. Low priority.
- **Per-lesson dwell-time override for image lessons.** Hardcoded 5s globally. Would be a column on `lessons`. Not implemented.

### Smoke tests not run against real production data
Tracker behavior + bulk ops + resend magic link + Mux happy/error paths were verified via scratch fixtures + playwright on the live deploy 2026-06-03 (see "Smoke verification" below). Still worth one more pass before real client cutover:

- **End-to-end live test with a real first client onboarding** — Orange Belgium employees actually using `/login` → magic link from email → onboarding → Reels feed → completion. Currently all verified pieces are admin or self-test (Dimi or seed `dimitris@parallel9.com`).
- **Mux failure UI from an admin's perspective.** The Mux error state + Resync button work in the backend (reproduced via real garbage-upload smoke), but no real admin has clicked Resync on a real broken upload. Wait until one happens naturally.

## Smoke verification approach (locked 2026-06-03)

When verifying admin actions or tracker behavior, use this pattern (proven against the full admin batch):

**1. Scratch fixtures via direct SQL.** Create a `QA Scratch` client + scratch employee + scratch lessons (with placeholder media URLs). Isolates the smoke from real seed data. Cleanup at the end drops the client (cascade-aware — drop users first to satisfy the FK).

**2. Playwright against the LIVE deploy** (not local dev) using the real admin cookie from `/tmp/dojo-login.sh`. The bulk-ops toolbar buttons, dropdown-select for assign/unassign, and `window.confirm()` dialog for delete are all covered by `page.on("dialog", d => d.accept())` + native `<select>` selectOption.

**3. Assert via DB + audit log.** Every successful admin action writes an `admin_audit_log` row. Assertions check both the DB row count change AND the audit row exists with the right action + target ids + payload.

**4. Tracker traces** use playwright's `page.on("request")` to capture POSTs to `/api/lessons/*/event` with bodies + timestamps. Then assert against a timeline of which lesson was active at each moment.

**5. Mux error path** is reproducible: `mux.video.uploads.create()` → PUT plain text to the upload URL with `Content-Type: video/mp4`. Within ~6 seconds Mux marks the asset `status: "errored"` with message `"The input file was not a valid video or audio file."`. Clean up via `mux.video.assets.delete()`.

Dex's smoke scripts live at `/tmp/dex-pw/` (separate from Iris's `/tmp/iris-pw/` — see shared-worktree discipline). The dir has its own `node_modules` with `playwright-core`, `postgres`, and `@mux/mux-node`.

## Workflow inventory (resolved 2026-06-03)

The original 27-existing-13-missing list locked 2026-06-02 has been resolved by Dimi's call during the user-side pivot:

**Shipped in this batch (8):**
- #1A Resend magic link (admin button on employee drill page)
- #3 Auto re-onboarding triggers (jwt-callback rule, no admin button; fires when employee's store no longer exists or their language is no longer in the client's allowed list)
- #4 Drill into individual employee history (`/admin/employees/[userId]` + `getEmployeeDetail` backend)
- #5 Mux upload error recovery (`mux_error_message` column + webhook captures errors + `resyncMuxUpload` action + UI states)
- #6 Preview-as-employee (per-client + per-lesson preview links, signed tokens, /preview/<token>/* pages)
- #8 Bulk operations on lessons (multi-select toolbar — publish/unpublish/assign/unassign/delete)
- #9 Translation fallback (media-aware viewer rule; no admin config surface — global "fall back to EN if preferred lang is missing or media-incomplete")
- #10 Audit log infrastructure + viewer at `/admin/audit-log`

**Explicitly skipped per Dimi (5):**
- #1B Force-revoke session — admins are always the Pandas team, no user session management needed.
- #2 Promote/demote/move user — collapses to admin role transitions which are already shipped; "move employee between clients" is a hard NO from Dimi.
- #7 Search/filter on long lists — Dojo won't have that many lessons either way.
- #11 Per-lesson scheduling — publish + assign is enough; no future-date publish needed.
- #12 CSV export of analytics — not relevant for now.

**Deferred entirely (1):**
- #13 Comments/feedback/questions — Dimi to pick the framing before any work.

## Conventions Iris uses

### Design language source-of-truth
- `src/app/globals.css` `@theme` carries the tokens — brand emerald `#10B981` is the affirmative accent. Signal colors per intent: green/amber/red. Geist Sans canonical. Sane `:focus-visible` ring. Honours `prefers-reduced-motion` globally.
- Surfaces are zinc neutrals on `bg-zinc-50` with white cards (`border-zinc-200`, `rounded-lg`, no shadow unless intentional). Restraint over expression — Linear/Stripe-dashboard reference.
- Internal admin is functional first; the employee Reels shell is the brand-expression surface.

### UI primitives discipline
- Compose, don't sprawl. New surfaces use `src/components/ui/*` primitives. If a pattern repeats 3+ times, lift it.
- Radix under the hood for anything that needs a11y (Dialog, Select, Switch, Sheet). No `npx shadcn add`; primitives are hand-pulled and shaped to Dojo.
- Class composition via `cn()` (`src/lib/cn.ts`) — `clsx + tailwind-merge`.
- Sonner for toasts. Mounted at admin layout root. `toast.success` / `toast.error` for feedback after server actions.
- Icons via `lucide-react`. Consistent sizes (`h-3.5 w-3.5` inline, `h-4 w-4` button-leading, `h-5 w-5` for empty-state circle).

### Reels-specific patterns (2026-06-03)
- One scroll-snap container per feed — all lessons stacked vertically, snap-mandatory.
- IntersectionObserver picks active section ≥60% visibility. Each viewer takes an `active` prop; only the active viewer autoplays + emits tracking.
- Inline-style gradients + GPU-promoted overlays (`transform: translateZ(0)`) sit over the Mux player's stacking context. **Real browsers always rendered the overlay correctly** — the visible bug during build was a `chromium-headless-shell` screenshot quirk that fails to capture overlays painted above an HTML5 `<video>` element (mux-player wraps a video in a web component / shadow DOM). Tailwind utility gradients emit the right CSS (curl-verified against live HTML); inline `linear-gradient(...)` styles are defensive — kept for clarity, not strictly required for the bug. See `feedback-playwright-headless-shell-video-overlay` memory.
- `object-fit: contain` everywhere — viewers letterbox rather than crop. Mux Player exposes `--media-object-fit` CSS var.

### Frontend ship pattern
- Direct commits to `main` while pre-prod. `tsc --noEmit` clean before commit.
- Don't `git add -A` — filemode flips on this filesystem bundle 100+ no-op changes. Stage explicit paths or use `-c core.fileMode=false`.
- New dependencies are best-in-class only and documented in the commit body.

### Visual + mobile QA loop
- Headless playwright against the LIVE deploy. Auth via `/tmp/dojo-login.sh`.
- `/tmp/iris-pw/` has `shoot.mjs` (desktop 1440×900) and `shoot-mobile.mjs` (390×844, isMobile, hasTouch). Both load the cookie jar.
- VPS has no X server. Pinch-zoomable screenshots cover the visual diff need.
- **Caveat from this session:** headless chromium-headless-shell can ghost overlays painted over an HTML5 video element. If a screenshot shows the overlay missing but JS confirms the element is rendered with the right rect/opacity, ask Dimi to verify on a real phone before assuming the design is broken — see commit `aa05617`+ history for the painful version of this lesson.

## Conventions Dex uses

### Backend ship pattern
- Direct commits to `main`, no PRs while pre-prod.
- `tsc --noEmit` clean before commit. The Railway build is reactive, not diagnostic.
- Don't `git add -A` — filemode flips. Stage explicit paths.
- Migrations: `DATABASE_URL=<DATABASE_PUBLIC_URL>` `npx drizzle-kit generate --name <slug>`. Lands in `drizzle/`, auto-runs on deploy via the `release` startCommand.
- Migrations additive when possible. Backfills as idempotent INSERTs inside the same `.sql` so re-runs are safe.

### Railway operations
- Don't use the railway CLI — Dex's account token is project-scoped and gets rejected for some operations. Use the GraphQL API at `https://backboard.railway.com/graphql/v2` with `Authorization: Bearer $RAILWAY_TOKEN` from `/personas/dex/.env`.
- **Cloudflare quirk:** Python `urllib` gets blocked by Cloudflare WAF in front of Railway. Use `curl` for GraphQL calls — its User-Agent is allowed.
- Set env vars via `variableUpsert`. Use `variableCollectionUpsert` for batches if your token has the scope; fall back to single `variableUpsert` calls if it returns 403.
- Bucket operations have a tooling gap: `bucketCreate` works via GraphQL but the `environmentId` arg is tagged "[unimplemented]" — the bucket gets created but the Tigris instance doesn't deploy. CLI/dashboard is the only path that materializes the instance. See `feedback-lane-escalate-not-borrow` memory.
- `deploymentLogs` shows runtime stdout (15–30s propagation lag). `buildLogs` shows the Nixpacks build. `environmentLogs` is more reliable for fresh runtime stdout — magic-link script uses it.
- `DATABASE_PUBLIC_URL` is the TCP-proxy host (`yamanote.proxy.rlwy.net:<port>`); the internal URL only resolves from inside the same Railway project.

### Auth.js v5 specifics
- Two configs by design: `src/lib/auth.config.ts` is the Edge-safe slim slice used by middleware; `src/lib/auth.ts` is the full Node config with the Drizzle adapter + Resend provider.
- Middleware reads claims off the JWT only. The full config's `jwt` callback self-heals role/clientId AND runs the auto-reonboarding check on `needsRefresh` (sign-in, explicit update, or stale claims) — NOT on every request.
- After mutating a user record server-side, call `unstable_update({ user: { … } })` to force a JWT re-issue without sign-out/sign-in.

### Tracking pattern (`useLessonTracking`)
- Hook is the single source of truth for client-side event emission. Components consume; nobody calls `/api/lessons/[id]/event` directly.
- Engagement heuristic mirrors `pandas-dynamic-lander`'s landing-page tracker — visible AND (active in last 30s OR a video playing). Final heartbeat fires via `sendBeacon` on `pagehide` / `visibilitychange-hidden` so a tab close doesn't lose the count.
- All event POSTs are fire-and-forget — the tracker never blocks or breaks the UI.
- Server dedupes `lesson_opened` and `lesson_completed` per `(user_id, lesson_id)`. `lesson_engagement` and `rating_submitted` always insert. Server also silently no-ops events when `session.user.role === "admin"`.
- Hook respects `enabled` flag — gated by the Reels feed's `active` state (only the visible lesson emits) + `disableTracking` flag (gated for preview surfaces).

### Audit log pattern
- Every admin server action calls `writeAuditEntry({ action, targetType, targetId, payload? })` from `src/lib/audit-log.ts` on the success path.
- Action vocabulary is namespaced: `<resource>.<verb>` (e.g. `lesson.publish`, `translation.image.update`, `client.domain.add`, `admin_member.add`, `employee.resend_magic_link`, `preview.client_link_created`, `employee.auto_reonboarding`). Documented inline in the helper file.
- Writes are best-effort — log failures are warned but never bubble up.
- System-triggered actions (e.g. auto re-onboarding) write with `actorUserId: null`.
- Read via `getAuditLog({ action?, targetType?, targetId?, actorUserId?, before?, limit? })`. Pagination via `before` cursor on `createdAt`.

### Tenant-scoping discipline
- `scopedDb(user)` is the only path for employee-facing reads/writes against tenant tables. The integration test fails the build if anyone reaches `db` directly for tenant data.
- Admin routes use raw `db` but self-authorize at the top: `if (session.user.role !== 'admin') return 403`. Never rely on middleware redirects for authorization — middleware redirects, it does not authorize.
- The denormalised `client_id` on `lesson_events` is set server-side at write time from the user's clientId — never accepted from the client payload.

### Migration-state cleanup
- `createLesson` server action (in `src/app/admin/lessons/actions.ts`) is dead code. New Lesson dialog routes through `createLessonFromUpload` / `createImageLesson` / `createCarouselLesson` exclusively. Safe to delete in a future cleanup pass.
- Several Reels-debug commits between `a1ac5d0` and `4daf19e` are noise — overlay rendering quirks during the Reels build. The final state is clean; ignore the debug history when reading the file diff for `ReelsFeed.tsx`.

## Shared-worktree discipline (added 2026-06-03)

**Dex and Iris share the same working tree at `/apps/dojo/`.** This means the git index is shared state between two parallel Claude sessions. A burned hour 2026-06-03 (commit `095179f` accidentally bundled four of Iris's WIP files into a Dex commit) led to two durable rules:

1. **`git diff --cached --stat` before every commit.** Read the file list. If anything's there you don't recognise, STOP and investigate. `git -c core.fileMode=false add <specific paths>` does NOT guarantee only those files are staged — the index can carry prior staged work from the peer session.
2. **One playwright dir per persona.** Iris's scripts live at `/tmp/iris-pw/`; Dex's at `/tmp/dex-pw/`. Each has its own `node_modules` (`postgres` + `playwright-core` + `@mux/mux-node` etc.). The chromium headless shell at `/tmp/iris-pw/.browsers/...` is reused via `PLAYWRIGHT_EXECUTABLE`.

If both bots are mid-edit on the same file, one stages-stashes-rebases-pops while the other holds. The "park your in-progress edit so the other can ship" pattern is the cooperative norm — see the 2026-06-03 aspect-ratio handoff in the chat log for the worked example.

## Telegram coordination (multi-bot discipline)

- **Chat ID:** `-5267432337` (dojo group, negative = group; positive = 1:1 DM).
- **Members:** Dimi (`user_id="1886796381"`, `@dlampidis`), Iris (`@irisisap9bot`), Dex (`@dexisap9bot`, `user_id="8474592678"`).
- Both Iris and Dex receive every message and coordinate via the channel.
- **When Dimi names ONE persona, the other stays silent.** "Iris, take the lead" = Dex doesn't reply unless directly pinged. Voice notes from Dimi addressed to one persona are still single-target.
- **"Shut up" = mute the channel, NOT the work.** When Dimi tells one bot to stop chattering, finish the work the lead asked for. Just don't post about it on Telegram. See `feedback_quiet_channel_when_dimi_says_shut_up` memory.
- **Ack-shape messages are noise.** For agreements that don't carry new info, stay silent. Cross-fire confirmations (both bots replying with the same answer) are the worst case.
- **ANNOUNCE / DONE on substantive work.** UPDATE only when materially over the original ETA or when state shifts.
- Voice notes arrive as `attachment_kind="voice"` → `ops-listen` (Whisper HTTP API) → treat the transcript as if Dimi typed it.
- Reply via `mcp__plugin_telegram_telegram__reply` with `chat_id` from the inbound message. Use `reply_to` only when threading under an earlier message — latest-message replies don't need it.

## Cross-channel awareness (Dex specifically)

Dex's persona is one Claude session receiving messages from MULTIPLE Telegram channels in parallel:

- **Dojo group** (`chat_id="-5267432337"`) — this project. Shared with Iris.
- **ContentOS group** (`chat_id="-5174263110"`) — separate project with Ted (CMO). Active strategy session there with a standing "between me and Ted" rule.
- **Dimi's 1:1 DM** (`chat_id="1886796381"`) — any project, operator-level.

When a message arrives, route mentally to the right project context. The dojo group is dojo work; ContentOS chat is ContentOS context (don't engage substantively unless explicitly pinged). See `feedback_strategy_session_hold_pattern` memory.

## Naming quirks worth knowing

- **`/api/lessons/[id]/complete`** is the legacy rating endpoint. Writes a `lesson_completions` row AND emits a `rating_submitted` event. The "complete" in the name is historical — it writes the rating, not the completion. Completions go through `/api/lessons/[id]/event` with `type: "lesson_completed"`.
- **`lesson_completions` table** also historical — rating data lives here (1–5 stars + `completed_at`). Completion status is read from `lesson_events`, not from this table.
- **`createLesson` server action** in `src/app/admin/lessons/actions.ts` is dead code. New Lesson dialog uses `createLessonFromUpload` / `createImageLesson` / `createCarouselLesson` exclusively.
- **`dojo-media` bucket auto-name** is actually `efficient-cornucopia-yWES` in the Railway dashboard. An orphan bucket from a failed first attempt (id `36eb98b4-…`) is still in the project blocking the human-readable name. Functionally fine — the Tigris-side bucket name in the creds is what S3 cares about.
- **Migration `0002_admin_audit_log.sql`** also adds three indexes. **`0003_mux_error_message.sql`** is the column for surfacing failures. **`0004_aspect_ratio.sql`** is the real-precision width/height ratio. All four migrations land on every deploy via the `release` startCommand.

## Reading order for a fresh session

1. `/apps/dojo/CLAUDE.md` — hard rules, workflow stance
2. **This file** — current state of play
3. `docs/spec.md` — product spec
4. `docs/architecture.md` — code layout + tenant scoping pattern
5. `docs/decisions.md` — running ADR
6. `docs/deploy.md` — Railway, env vars, webhooks

Then reality check:
- `cd /apps/dojo && git status && git log --oneline -20` — if git is ahead of the "Recent commits" table above, read the new commits to catch up.
- `curl https://web-s2cr-production.up.railway.app/api/health` — confirm prod is live.
- If anything is mid-merge / dirty / on an unfamiliar branch, STOP and ask Dimi.

Then ping Dimi in the dojo Telegram group confirming you're caught up, and let him say what to pick up next. The largest outstanding lift is the Library view (`/browse`) redesign.

## Companion handoffs

- ContentOS (no app dir yet; pre-Stage-0): `_studio/outputs/handoffs/2026-06-02-contentos-handoff.md`. Will move to `/apps/contentos/docs/HANDOFF.md` on Stage 0 scaffolding.
- (Other projects don't have HANDOFF docs at the same level of detail yet.)
