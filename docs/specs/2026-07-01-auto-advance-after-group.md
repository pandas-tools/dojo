# Auto-advance to next unwatched after group celebration

**Date:** 2026-07-01
**Status:** Draft (design)
**Surface:** `/watch/[id]` (Reels feed)

## Problem

When a user completes the last lesson in a group, the current UX is:

1. Group-completion celebration modal appears with a rating prompt.
2. User rates and dismisses (or dismisses directly).
3. The video underneath is `loop`, so it keeps replaying. The active feed item does not change.
4. The user is left rewatching a lesson they just finished, with no cue to move on. They have to manually swipe to the next feed item — which, because the feed is unsorted with respect to watched-state, may be another already-completed lesson.

Result: the "you just finished a group" moment ends in a dead-end. Progression breaks.

## Desired behavior

After a celebration burst finishes draining (the last modal in the queue pops), the feed scrolls to the next unwatched lesson.

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
- If **none** are unwatched: navigate to `/browse`. This mirrors the exhausted state already handled in `(shell)/layout.tsx` (where `firstIncomplete` falls back to `lessons[0]` for onboarding, but exhausted-mid-session belongs on `/browse` as the "you're done for now" surface).

### Stacked-celebration behavior

Only the last pop of a burst that included a `groupCompleted` triggers the advance. If the user rates the group, then dismisses `tierUnlocked`, then dismisses `firstThreeComplete`, exactly one scroll happens — after the third dismiss.

If a burst does NOT include a `groupCompleted` (e.g., a lone `tierUnlocked` mid-group, or a lone `firstThreeComplete` on lesson 3 of a 5-lesson group), no advance fires. The user dismisses and stays on the current lesson.

### Preview mode

`disableTracking` short-circuits the advance. `initialCompleted` is not passed (or passed as an empty set) and celebrations still render but the completion-set update and the advance do not fire.

## Edge cases

- **Feed of length 1**: after celebration drain, there IS no other item. Route to `/browse`.
- **User scrolls to a different lesson mid-celebration**: the celebration modal blocks scroll gestures currently, so this shouldn't happen. If it does, we still advance from the (new) `activeIndex` at the moment the burst ends — that's the correct anchor.
- **User completes the same group twice by re-watching**: `groupCompleted.alreadyRated` short-circuits the celebration ([ReelsFeed.tsx:157](../../src/app/watch/[id]/ReelsFeed.tsx#L157)). No celebration → no burst → no advance. Correct.
- **A tier / first-three fires with no group**: no advance. See "Stacked-celebration behavior" above.
- **Tier or first-three fires AT the same moment as a group completion**: the burst includes a `groupCompleted`, so advance DOES fire — once, after the last modal pops. Correct.

## Non-goals

- Reordering the feed itself (still `sortOrder ASC` from the DB).
- Auto-advance on mid-group lesson completion.
- Cross-group visual signaling ("you're now in group X") — separate design.

## Testing

- **Unit**: a small `nextUnwatchedIndex(items, activeIndex, completedSet)` pure function is easy to test — cover: forward hit, wraparound hit, all-completed → -1, active is only uncompleted → -1.
- **Integration** (Vitest, existing pattern): mount `ReelsFeed` with a test items array and simulate `handleLessonCompleted` fires with a `groupCompleted` payload. Assert that after `submitGroupRating` resolves, `scrollIntoView` is called on the expected next-unwatched section (mock via `sectionRefs`). Also assert the negative case: a `tierUnlocked`-only payload does NOT trigger `scrollIntoView` after dismissal.
- **Manual**: preview URL, use test tenant with a fixture user 3 lessons deep in a 4-lesson group. Complete lesson 4 → rate → observe scroll to next-unwatched lesson in a different group.

## Rollout

Single PR. No feature flag — the change is additive to a moment that currently does nothing.

## Related

- Existing `completedIds` pattern: [`(shell)/layout.tsx`](../../src/app/(shell)/layout.tsx), [`page.tsx`](../../src/app/page.tsx), [`browse.ts`](../../src/lib/browse.ts).
- Celebration queue logic: [`ReelsFeed.tsx:143-175`](../../src/app/watch/[id]/ReelsFeed.tsx#L143-L175).
- Feed order: [`scoped.ts:135`](../../src/lib/db/scoped.ts#L135) (`sortOrder ASC`).
