# Auto-advance + training-complete copy on the Expert tier modal

**Date:** 2026-07-01
**Status:** Draft (design)
**Surface:** `/watch/[id]` (Reels feed)

## Problem

Two related dead-ends on the Reels feed:

**(1) Group-end dead-end.** When a user completes the last lesson in a group:
1. Group-completion celebration modal appears with a rating prompt.
2. User rates and dismisses (or dismisses directly).
3. The video underneath is `loop`, so it keeps replaying. The active feed item does not change.
4. The user is left rewatching a lesson they just finished, with no cue to move on. They have to manually swipe to the next feed item — which, because the feed is unsorted with respect to watched-state, may be another already-completed lesson.

**(2) Training-complete miscommunication.** When a user completes THEIR LAST lesson, the Expert tier modal fires with:

> Congrats! You've just unlocked a new tier.
> **Keep going — new lessons just opened up.**

That subtitle is misleading — nothing new opened up, they're done. There's no separate "training complete" screen.

Result: the "you just finished a group" moment ends in a dead-end, and the "you just finished EVERYTHING" moment tells you to keep going.

## Desired behavior

1. After a celebration burst finishes draining (the last modal in the queue pops), the feed scrolls to the next unwatched lesson.
2. When the Expert tier modal (or any tier modal) fires AT 100% completion, its subtitle switches from "Keep going — new lessons just opened up." to copy that acknowledges the end. No new modal — reuse the existing tier surface.

## Scope

- **In**: celebration bursts that include a `groupCompleted` signal. When the last modal in that burst pops, auto-advance fires.
- **Out**: mid-group lesson completion, whether or not a `tierUnlocked` or `firstThreeComplete` fires alongside. Feed stays as-is; user swipes manually. Rationale: Reels-style UX is swipe-driven; auto-advance mid-group would fight the pattern. Tier and first-three are count-based (not group-boundary-based), so they can fire mid-group — advancing on them would rip the user out of a group they're in the middle of.
- **Out**: preview mode (`disableTracking`). No user identity, no completion state to reason about.

## Design

### Data flow

- **Server** ([watch/[id]/page.tsx](../../src/app/watch/[id]/page.tsx)): fetch `completedIds: Set<string>` via the existing scoped query (already used in `(shell)/layout.tsx` and root `page.tsx`), pass to `ReelsFeed` as a new `initialCompleted` prop.
- **Client** ([ReelsFeed.tsx](../../src/app/watch/[id]/ReelsFeed.tsx)): maintain a `completed` set in state, initialized from `initialCompleted`. When `handleLessonCompleted` fires for a lesson id, add it to the set (optimistic; matches the server event that produced the celebration).

### Trigger

- Add a `advancePendingRef: boolean` ref. Set it to `true` inside `handleLessonCompleted` if and only if the incoming payload contains a fresh `groupCompleted` (i.e., the same condition that enqueues the group modal — `res.groupCompleted && !res.groupCompleted.alreadyRated`).
- Add an effect that watches `celebrations.length`. When it transitions from `>0` to `0` AND `advancePendingRef.current === true`, fire the advance and set the ref back to `false`.
- The ref-based flag (rather than watching burst kinds inside the effect) keeps the trigger source-of-truth co-located with the enqueue site, and cleanly ignores initial-mount `celebrations.length === 0`.

### "Next unwatched" resolution

- Walk `items` starting at `activeIndex + 1`, wrapping to `0` on the way, stopping at `activeIndex` again. The first item whose id is NOT in the `completed` set wins.
- Call `gotoIndex(nextIndex)` (existing helper — smooth scroll to that section).
- If **none** are unwatched: cycle to `(activeIndex + 1) % items.length` — the next lesson in scroll order, watched or not. Keeps the user inside the Reels tab rather than ejecting to `/browse`; the training-complete tier modal (below) still fires beforehand, so the "you're done" signal is preserved without ripping them out of the feed. **Reversed from the original 2026-07-01 decision** (which routed to `/browse`) — see 2026-07-02 note below.

### Stacked-celebration behavior

Only the last pop of a burst that included a `groupCompleted` triggers the advance. If the user rates the group, then dismisses `tierUnlocked`, then dismisses `firstThreeComplete`, exactly one scroll happens — after the third dismiss.

If a burst does NOT include a `groupCompleted` (e.g., a lone `tierUnlocked` mid-group, or a lone `firstThreeComplete` on lesson 3 of a 5-lesson group), no advance fires. The user dismisses and stays on the current lesson.

### Preview mode

`disableTracking` short-circuits the advance. `initialCompleted` is not passed (or passed as an empty set) and celebrations still render but the completion-set update and the advance do not fire.

### Tier modal subtitle at 100% completion

- **Server**: augment the `tierUnlocked` payload from [`scoped.ts:751`](../../src/lib/db/scoped.ts#L751) with a `trainingComplete: boolean` field. True when `completedAfter === total` (i.e., the tier crossing that fires because of this event ALSO brings the user to 100% of their assigned lessons). The existing `completedAfter` and `total` values inside `tierCrossing.detectForLesson` already have what's needed; no new query.
- **Type**: extend `LessonCompletedResponse["tierUnlocked"]` in [`useLessonTracking.ts:35`](../../src/lib/useLessonTracking.ts#L35) with the optional `trainingComplete?: boolean`.
- **Client**: in [`ReelsFeed.tsx`](../../src/app/watch/[id]/ReelsFeed.tsx) the `Celebration` union's `tier` variant gains `trainingComplete: boolean`, populated from `res.tierUnlocked.trainingComplete`. The tier celebration render block ([`ReelsFeed.tsx:893`](../../src/app/watch/[id]/ReelsFeed.tsx#L893)) branches on this flag:
  - **`false` (default)** — current subtitle: "Keep going — new lessons just opened up."
  - **`true`** — new subtitle: "That's every lesson done. Nice work."
- **Design preview**: [`design-preview/success-tier/page.tsx`](../../src/app/design-preview/success-tier/page.tsx) gets a `?complete=1` query param so we can review both copy states without a fixture. When present, renders with the new subtitle. Add a second entry in the [`design-preview/page.tsx`](../../src/app/design-preview/page.tsx) index list — "Success — new tier (training complete)" pointing to the query-param variant — so it's discoverable.
- **Copy notes**: title ("Congrats! You've just unlocked a new tier.") stays — Expert IS a new tier. Only the subtitle changes. Kept short and un-exclaimed to match the Iris/Dojo tone; open to tuning during review.

### Interaction with auto-advance

The training-complete case is a natural fit for the exhausted branch of auto-advance:
1. User completes final lesson → server emits `groupCompleted` + `tierUnlocked{trainingComplete: true}`.
2. Celebration queue: tier modal first (with new subtitle), then group modal (rating).
3. `advancePendingRef` is set to `true` by the fresh `groupCompleted`.
4. User dismisses both → burst drains → advance fires → walks feed → nothing unwatched → cycles to the next lesson in scroll order (already watched).

The two features compose cleanly with no special-case branching for "last lesson."

## Edge cases

- **Feed of length 1**: after celebration drain, `(0 + 1) % 1 === 0` — the cycle target IS the current section, so the smooth-scroll is a no-op. User stays put. Correct.
- **User scrolls to a different lesson mid-celebration**: the celebration modal blocks scroll gestures currently, so this shouldn't happen. If it does, we still advance from the (new) `activeIndex` at the moment the burst ends — that's the correct anchor.
- **User completes the same group twice by re-watching**: `groupCompleted.alreadyRated` short-circuits the celebration ([ReelsFeed.tsx:157](../../src/app/watch/[id]/ReelsFeed.tsx#L157)). No celebration → no burst → no advance. Correct.
- **A tier / first-three fires with no group**: no advance. See "Stacked-celebration behavior" above.
- **Tier or first-three fires AT the same moment as a group completion**: the burst includes a `groupCompleted`, so advance DOES fire — once, after the last modal pops. Correct.

## Non-goals

- Reordering the feed itself (still `sortOrder ASC` from the DB).
- Auto-advance on mid-group lesson completion.
- Cross-group visual signaling ("you're now in group X") — separate design.
- A distinct, standalone "training complete" success screen. Reusing the tier modal with a subtitle switch is the smaller, correct change.
- Changing the tier modal for the intermediate-tier case (Apprentice→Specialist, or Specialist→Expert BEFORE 100%). Copy stays as-is.

## Testing

- **Unit**: a small `nextUnwatchedIndex(items, activeIndex, completedSet)` pure function is easy to test — cover: forward hit, wraparound hit, all-completed → -1, active is only uncompleted → -1.
- **Integration** (Vitest, existing pattern): mount `ReelsFeed` with a test items array and simulate `handleLessonCompleted` fires with a `groupCompleted` payload. Assert that after `submitGroupRating` resolves, `scrollIntoView` is called on the expected next-unwatched section (mock via `sectionRefs`). Also assert the negative case: a `tierUnlocked`-only payload does NOT trigger `scrollIntoView` after dismissal.
- **Server unit** (extend [`success-detectors.test.ts`](../../src/tests/success-detectors.test.ts)): a scenario where completion #N crosses into the top tier AND brings the user to 100%. Assert the returned `tierUnlocked.trainingComplete === true`. Also assert `false` for a mid-tier crossing that doesn't hit 100%.
- **Manual**: preview URL, use test tenant with a fixture user 3 lessons deep in a 4-lesson group. Complete lesson 4 → rate → observe scroll to next-unwatched lesson in a different group. Then complete the very last lesson → observe the Expert modal with the new "That's every lesson done" subtitle → dismiss → observe smooth-scroll to the next lesson in scroll order (already watched) — user stays in the Reels feed.

## Rollout

Single PR bundling both changes. No feature flag — the auto-advance is additive to a dead-end moment, and the tier-copy switch is a subtitle swap gated on a server-emitted flag that defaults to `false` for every existing case except the true training-complete crossing.

## Related

- Existing `completedIds` pattern: [`(shell)/layout.tsx`](../../src/app/(shell)/layout.tsx), [`page.tsx`](../../src/app/page.tsx), [`browse.ts`](../../src/lib/browse.ts).
- Celebration queue logic: [`ReelsFeed.tsx:143-175`](../../src/app/watch/[id]/ReelsFeed.tsx#L143-L175).
- Feed order: [`scoped.ts:135`](../../src/lib/db/scoped.ts#L135) (`sortOrder ASC`).

## Revision — 2026-07-02

The **exhausted-feed branch** of auto-advance was changed from "route to `/browse`" to "cycle to `(activeIndex + 1) % items.length`" (see "Next unwatched" resolution above). Rationale from Dimi: the Watch tab shouldn't dead-end. Group-completion celebration still fires exactly as before — after dismissal, the user simply stays in the Reels feed instead of being ejected. The training-complete tier modal still carries the "That's every lesson done" signal, so nothing is lost semantically.
