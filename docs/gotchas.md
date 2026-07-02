# Gotchas

Non-obvious traps that cost real debugging time. Add one when a bug's root
cause wasn't visible from the symptom.

## Reels feed: deep-linked lesson black-screened on mobile-Safari hard reload

**Symptom.** Hard-reloading a deep-linked `/watch/<id>` on iPhone Safari (where
`<id>` is not the first lesson): the overlay title briefly flashed a different
lesson before settling, the URL rewrote itself to the first lesson, and the
target video rendered black — no poster, no frame. Icons were fine. Never
repro'd on desktop, on in-app swipe navigation, or when the deep link was the
first lesson.

**Root cause.** `ReelsFeed` seeds `activeIndex` from the deep-link target and
then programmatically `scrollIntoView`s the container to that section on mount.
The `IntersectionObserver` is the *only* writer of `activeIndex`. On a
mobile-Safari hard reload its first delivery computes intersections *before* the
mount scroll has settled — the container is still parked at section 0 (its SSR
position) while the dynamic-viewport (`dvh`) layout stabilises — so it reports
section 0 and writes `activeIndex = 0`. That single stray write caused all three
symptoms at once, which is why they were correlated:

- **Title flicker** — the overlay renders `items[activeIndex].title`.
- **URL rewrite** — the URL-sync effect `history.replaceState`s to `items[0]`.
- **Black video** — the target's `active` flips true→false, so the play/pause
  effect calls `el.pause()` mid autoplay cold-start (and drops `autoPlay` /
  `preload`). When the scroll settles and `active` returns to true, Mux's
  interrupted cold-start is left paused at no rendered frame → black.

`initialIndex === 0` never repro'd because the stray "section 0" reading *is*
the target — no flip. Desktop/swipe never repro'd: no remount race, lenient
autoplay policy, stable viewport.

**Fix.** `observationGuard.ts` — the observer suppresses every observation of a
NON-target section until it has seen the deep-link target itself settle. From
that point it drives `activeIndex` freely. One guard on the single writer kills
all three symptoms because they share one cause. A first-user-gesture safety
valve (`pointerdown`/`touchstart`/`wheel`) hands the observer control
unconditionally so the guard can never wedge if the mount scroll fails to land.

**Lesson.** When a scroll-position observer is the source of truth for state
that a deep link *also* seeds, the two race on mount. Gate the observer until
the programmatic initial scroll has demonstrably reached its target — don't let
a transient "top of container" reading clobber the seeded state.
