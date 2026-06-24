# Decisions

Running ADR for `dojo`. New decisions go at the top with a date and status. See also `.claude/_studio/decisions/` for cross-project decisions (the stack-pivot rationale lives there).

---

## 2026-06-24 — Dynamic "New lessons" rail at top of `/browse`

**Status:** Decided.

**Decision:** A virtual rail titled exactly "New lessons" appears at the top of `/browse` when there's at least one lesson published since the current user's last visit.

- **High-water mark** — `users.last_new_lessons_checked_at timestamptz` per user. Read at request time; bumped to `now()` on every `/browse` render (best-effort, fire-and-forget). Trade accepted: a user sees the rail once per fresh batch; closing the tab without scrolling doesn't refund the visual.
- **Publish moment** — `lessons.published_at` (set on `is_published` false→true, backfilled = `created_at` for existing rows) is the threshold field. Avoids `created_at` ambiguity for lessons authored long before publish.
- **Read shape** — `getBrowseData` returns a separate `newRail: BrowseGroup | undefined` field, NOT an extra entry in `groups[]`. Reason: lessons in `newRail` ALSO stay in their normal editorial group, and totals/tier-progress/Reels should count each lesson exactly once. Embedding in `groups[]` would force the shaper/consumer to dedupe everywhere.
- **UI** — Iris renders `data.newRail` first, then `data.groups.map(...)`. Per-card "NEW" badge / per-rail visual treatment deferred.

**Why:** Returning users (the realistic mode for retail employees) need an obvious "what's new" signal. Anchoring to a per-user high-water mark beats globally-recent (which would re-surface to people who already saw it).

**Trade-off:** Doesn't depend on the lesson-in-multiple-groups schema change Dimi also asked about — independent feature, smaller lift. The Netflix cross-tag pattern is deferred.

---

## 2026-06-24 — Gamification: 3-tier ladder, dignity-first naming, no leaderboard

**Status:** Decided.

**Decision:** The gamification system is a tier ladder, not points/coins/leaderboards.

- **Tier names + emojis (v1 seed):** 🌱 Apprentice → ⚡ Specialist → 🏆 Expert. Tier count, names, emojis, and thresholds are all editable in `/admin/tiers` (see separate ADR), so this is the *starting* ladder, not a permanent one.
- **No individual leaderboards.** Adult retail employees read kid-app gamification cynically; leaderboards create losers in a tight team. Rejected.
- **Counts shown are CLIENT-WIDE, not store-level.** Dimi explicit: "I don't want to make each store specific at all — [the user] is competing against all the people in the entire organisation."
- **Per-tier visibility rule:** counts only on tiers ABOVE the user's current tier (and only when count > 0); the user's own tier and tiers below stay silent. Tiers below get a "Completed" pill instead. Never name names; never shame the lowest tier.
- **Avatar = email's first letter, uppercased.** Display name not collected at onboarding (Dimi: "we don't need the first name"). Trade-off documented in `HANDOFF.md` pending list.

**Why:** Mechanics for adults differ from mechanics for kids. Store-level was rejected because it makes a quiet store feel under-pressure compared to a busy one even though both are doing their job. Tier framing ("Apprentice / Specialist / Expert") borrows literal Apple Store vocabulary, which is native to the Apple Premium Partner audience.

**Trade-off:** Generic mailboxes (info@, sales@) collapse to one letter on the avatar. Acceptable given the audience is named individual employees.

---

## 2026-06-24 — Employee surface: dark, floating bottom nav, Reels immersive

**Status:** Decided.

**Decision:** The entire employee-facing surface (`/browse`, `/saved`, `/profile`, `/watch/*`) is dark (black bg, white type). Admin (`/admin/*`) stays light. Login + onboarding stay light for now (pending a follow-up).

- **Floating bottom nav** — Instagram-style pill (`bg-zinc-900/95 rounded-full`), four tabs (Library, Reels, Saved, Avatar→Profile), `safe-area-inset-bottom` padding. Mounted per-page on the three flat surfaces. **Hidden on `/watch/[id]`** for full Reels immersion — the back chevron is the only way out. (Initially mounted with `overlay` backdrop; Dimi reversed the call mid-session.)
- **Reels nav link is computed per-page**, pointing directly at `/watch/[firstIncompleteId]` rather than the `/watch` redirect helper. Skips the double-navigation flash that was visible even with Suspense fallbacks on both routes. `/watch` (no id) still exists as a fallback for direct-URL access.
- **Sign-out moved off `/browse`** to `/profile`. Red treatment, single button. The only way out of the session.
- **`loading.tsx` in `src/app/watch/{,[id]}/`** returns a fixed-position black div so the Suspense fallback during route transitions stays black instead of bleeding the root body's `bg-zinc-50` through.

**Why:** Reels is the brand-expression surface; `/browse` is the on-ramp. Tonal continuity reads as one app, not two. Bottom nav matches mobile-native expectations (the primary surface per `spec.md §1.1`).

**Trade-off:** Sign-out flow goes dark → light when redirecting to `/login`, which can flash. Accepted as rare. Onboarding/login dark redesign deferred.

---

## 2026-06-24 — `/browse` redesign visual specifics

**Status:** Decided (visual hygiene baseline; further tuning is normal product work).

**Decision:** The library surface uses these specifics, ratified by Dimi iteratively in-session:

- **Cards** — 4:5 portrait (Instagram), `rounded-lg` (8px) corners, `object-cover` poster. Mobile width `w-[38vw]` (max 200px), targeting ~2.33 cards per row with a strong peek of the next card. Desktop scales to `sm:w-44 / md:w-48 / lg:w-52`.
- **Per-rail layout** — horizontal scroll-snap-mandatory, hidden scrollbars, gap `8px` mobile / `12px` desktop.
- **Per-content-type cues** — centered translucent play badge on video cards only. Image and carousel cards stay clean.
- **Bookmark** — bottom-right corner of every card; white-outlined when off, red filled when saved. Optimistic toggle with `e.stopPropagation()` so it doesn't follow the card's link.
- **Done indicator** — small emerald pill top-left of completed cards.
- **Tier hero card** — single line "You are [emoji] {Tier} · X lessons to {NextTier}" with chevron-right; tap opens the modal. Sits ABOVE the page title.
- **Tier modal** — Radix Dialog (true centered pop-up, no slide). Three tier rows stacked vertically, highest tier on top; current tier ringed + YOU badge + email-initial avatar; tiers above show "X ahead / of you" when count > 0; tiers below show "✓ Completed" pill. Row colors are POSITIONAL (first = amber, top = emerald/brand, middle = sky) so the treatment holds for any N-tier ladder.

**Why:** Codifies the values Dimi tuned in-session so they don't drift on the next pass.

**Trade-off:** Card width is in viewport units (`vw`) — looks correct on phones but pre-`sm` breakpoint (640px) tablets get fairly wide cards. Acceptable; mobile-first per spec §1.1.

---

## 2026-06-24 — Tier system productized (data-driven `lesson_tiers`)

**Status:** Decided. Backend shipped (this change); `/browse` UI rewire follows.

**Decision:** Replace the code-defined Apprentice/Specialist/Expert ladder (`src/lib/tier.ts` constants + `MOCKED_TIER_COUNTS` in `/browse`) with a data-driven system:

1. **Schema** — `lesson_tiers` (`id, client_id NULLABLE, name, emoji, min_pct, sort_order, is_active, timestamps`). `client_id NULL` = the global default ladder used by every client; a non-null `client_id` is a future per-client override (the nullable column means per-client ladders land later with **no schema change**). Admin v1 manages the global ladder only. `sort_order` is intentionally **not unique** — reorder swaps two rows' `sort_order` in one txn, mirroring the `lessons` table.

2. **Threshold model** — `min_pct` is a 0..1 fraction of the client's assigned, published lessons completed. Percent, not absolute count, so a tier stays meaningful as a client's curriculum grows. **Classification orders by `min_pct`** (threshold = source of truth for progression); `sort_order` is only display order, so the two are decoupled and reordering never reclassifies anyone.

3. **Counts are CLIENT-WIDE only** (Dimi, explicit) — an employee competes against everyone in their whole organisation, not their store. The store-level rollup was dropped. Read shape: `{ tiers, me: { completed, total, tierId }, counts: Record<tierId, number> }`.

4. **Runtime** — pure logic (types, `classifyTier`, `FALLBACK_TIERS`) in `src/lib/tiers.ts` (client-safe, unit-tested); live readers (`getTierConfig`, `getClientTierRollup`, `getBrowseTierData`) in `src/lib/tiers-data.ts` (server-only, request-memoized via React `cache`). **Defensive fallback:** an empty or unreachable table resolves to the built-in 3 tiers, so the hero can never blank.

5. **Admin** — new `/admin/tiers` (create/rename/delete/reorder + threshold edit), audit-logged (`tier.*`), neighbour-swap reorder. Ladder validation (in-txn): the lowest tier must be 0%, and no two tiers may share a threshold.

6. **Migration** — `0006_lesson_tiers` creates the table and **idempotently seeds the current 3 global tiers** (fixed UUIDs + `ON CONFLICT (id) DO NOTHING`) in the same file, so the seeded ladder exists the instant the migration applies — before any rerouted consumer reads it. The old `src/lib/tier.ts` + mocked `/browse` consumer stay in place until the UI rewire swaps them.

**Why:** Dimi wants tier count, names, emojis, and thresholds all editable in data without code changes, and the colleague counts live instead of mocked.

**Trade-off:** Two tier modules briefly coexist (`tier.ts` legacy + `tiers.ts`/`tiers-data.ts`) until the `/browse` rewire lands and the legacy file is deleted.

---

## 2026-06-23 — Lesson groups (editorial sections) + bookmarks for the /browse redesign

**Status:** Decided.

**Decision:** Back the redesigned employee `/browse` (dark, Reels-style rails) with two additions:

1. **Lesson groups** — global editorial sections (`lesson_groups`: `id, name, sort_order`), like `lessons` themselves. A lesson belongs to at most one group via a nullable `lessons.group_id` FK (`ON DELETE SET NULL` — deleting a group orphans its lessons, never deletes them). Within-group order lives in a **dedicated `lessons.group_sort_order` column**, kept separate from the global `lessons.sort_order` that drives the `/admin/lessons` master list. A client sees its assigned+published lessons bucketed under each group; empty groups are dropped, and ungrouped lessons fall into a trailing "More lessons" bucket ordered by global `sort_order`.

2. **Lesson bookmarks** — per-user "save for later" (`lesson_bookmarks`: PK `(user_id, lesson_id)`). `toggleBookmark(lessonId)` server action returns `{ bookmarked }`; the assignment guard + tenant scoping live in `scopedDb.bookmarks`.

The employee read is `getBrowseData(user)` in `src/lib/browse.ts` → returns `groups[] { id, name, sortOrder, cards[] }`, each card carrying `isBookmarked`. The pure grouping/ordering logic is split into `src/lib/browse-shape.ts` (no DB import) so it's unit-tested in isolation. Admin management lives at `/admin/lesson-groups` (create/rename/delete/reorder groups; assign + reorder lessons within a group), audit-logged under `lesson_group.*`.

**Why:** Groups are global because the editorial taxonomy ("Managing the store", "Customer flows") is Pandas-defined, like the lessons it organises — mirroring the existing global-lessons + per-client `client_lessons` assignment model. A separate `group_sort_order` column (vs. reusing `sort_order`) is the key call: sharing one column would mean assigning a lesson to a group silently reshuffles the global `/admin/lessons` list and the two reorder surfaces fight over one column. Two columns keep both orderings independent and stable.

**Trade-off:** A lesson can be in only one group (matches the mock; no polymorphic over-engineering). Reorder UI uses up/down arrows (no drag-and-drop library in the stack yet), consistent with the existing `/admin/lessons` reorder. Migration `0005` is purely additive.

---

## 2026-05-14 — Postgres on Railway, no Row-Level Security

**Status:** Decided.

**Decision:** Postgres lives on Railway as a managed service. RLS is not used. Tenant isolation is enforced in the app layer via a `scopedDb(user)` query helper.

**Why:** The original spec (with Supabase) leaned on RLS because the database was the trust boundary for many independent clients (Supabase SDK, dashboard, edge functions). Here we have one Next.js app talking to Postgres. A single query helper + integration tests is simpler than parallel SQL policy files and gives us the same guarantee. Also: Postgres on Railway is just Postgres — no vendor lock-in on the data plane.

**Trade-off:** If we ever add another service that hits the DB directly (e.g., a background worker not written in this repo), it must also use the helper or write its own scoping. We add a CI test that proves cross-tenant reads are rejected.

---

## 2026-05-14 — Auth.js v5 + Resend (magic link)

**Status:** Decided.

**Decision:** Use `next-auth@5.0.0-beta.31+` with the Resend email provider. JWT strategy.

**Why:** Auth.js v5 is the idiomatic auth library for Next.js. The Resend provider is first-class. JWT (over DB sessions) keeps the hot path off Postgres. Drizzle adapter handles user/account/verification-token tables.

**Trade-off:** We're on a beta. Pin the version and watch for breaking changes between betas. The v5 API has stabilized enough by beta.31 to be safe.

---

## 2026-05-14 — Drizzle, not Prisma

**Status:** Decided.

**Decision:** Drizzle ORM for schema, migrations, and queries.

**Why:** Drizzle is closer to raw SQL than Prisma — easier to reason about, lighter runtime, and the migration story is plain SQL files (which we can hand-edit if needed). Prisma's generated client + schema language is a heavier abstraction for a project where most queries are tenant-scoped variations of `select … where client_id = $1`.

**Trade-off:** Smaller ecosystem of GUI tools. `drizzle-kit studio` covers our needs.

---

## 2026-05-14 — No shadcn/ui yet

**Status:** Decided (revisit after MVP ships).

**Decision:** Plain Tailwind utility classes, hand-rolled HTML forms, no component library in Phase 1–4.

**Why:** Per Dimi's directive ("functional, ugly, end-to-end usable; we polish later"), we ship the vertical slice without a design system. A component library reflexively introduced before we know what we need ends up shaping decisions rather than serving them.

**Trade-off:** UI will look unfinished. Acceptable for internal training portal. When we polish, we re-evaluate (shadcn/ui vs. mantine vs. hand-rolled with design tokens).
