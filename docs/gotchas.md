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

**Fix.** The deep-link target must stay locked until it has *actually landed*,
against every force that can move the scroll during the mount transient. There
are three, and guarding only the first is not enough:

1. **The IntersectionObserver** (`observationGuard.ts`) — suppresses every
   observation of a NON-target section until it has seen the target settle; from
   there it drives `activeIndex` freely.
2. **The tail-sentinel teleport** (infinite-scroll wrap) — `container.scrollTop
   = items[0].offsetTop` whenever the tail sentinel is ≥0.9 in view. Deep-linking
   to the LAST lesson lands right next to the sentinel, and on mobile Safari the
   mount/`dvh` transient can flash it ≥0.9 and teleport to section 0 (black +
   items[0] title) *before the user has scrolled at all*. Gated behind
   `userEngagedRef` — a flag set ONLY by a real touch/pointer/wheel gesture — so
   the wrap can never fire from programmatic scrolling (mount, dvh reflow,
   auto-advance).
3. **The mount scroll itself** — a one-shot `scrollIntoView` is unreliable on
   iOS Safari (unsettled `dvh` heights at hydration, scroll restoration, URL-bar
   reflow). Replaced with a bounded `requestAnimationFrame` loop that re-asserts
   `scrollTop = target.offsetTop` every frame until the observer confirms arrival
   or the user takes over.

A first-user-gesture safety valve (`pointerdown`/`touchstart`/`wheel`) flips both
`reconciledRef` and `userEngagedRef`, so nothing can wedge.

**Lesson.** When a deep link seeds scroll-derived state, EVERY actor that writes
scroll position or that state races the mount. Enumerate them all (observer,
any teleport/wrap, the initial scroll) and lock each to the target until it has
demonstrably landed — a guard on just one actor leaves the others to clobber it.
The first fix guarded only the observer; the sentinel and the flaky scroll still
bounced the deep link to section 0. Also: a headless Chromium probe could NOT
reproduce this (it lands correctly every time) — the failure is specific to iOS
Safari's mount timing, so it needs on-device confirmation.
