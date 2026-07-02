// Pure helper guarding the Reels feed's IntersectionObserver against the
// mount-scroll race that black-framed deep-linked lessons on mobile Safari.
//
// The feed seeds activeIndex from the deep-link target, then programmatically
// scrolls the container to that section on mount. On a mobile-Safari hard
// reload the observer's FIRST delivery can compute intersections before that
// scroll has settled — the container is still parked at section 0 — so it
// reports the wrong (top) section and yanks activeIndex off the target. That
// single stray write flickered the overlay title, rewrote the URL via
// replaceState, and flipped the target video's `active` false→true, thrashing
// Mux's autoplay cold-start into a paused black frame.
//
// The guard suppresses every observation of a NON-target section until the
// observer has seen the deep-link target itself settle. Once it has, the user
// is in control and the observer drives activeIndex freely from then on.
// (When the target IS index 0 the very first observation reconciles, so this
// is a no-op — matching that deep-links to the first lesson never repro'd.)
export function reconcileObservation(params: {
  /** Index the observer just reported as most in-view. */
  observedIndex: number;
  /** Index of the deep-link target the feed mounted on. */
  initialIndex: number;
  /** Whether the observer has already reconciled with the target. */
  reconciled: boolean;
}): { accept: boolean; reconciled: boolean } {
  const { observedIndex, initialIndex, reconciled } = params;
  if (reconciled) return { accept: true, reconciled: true };
  // Not yet reconciled: only the target may pass. Seeing it settle hands the
  // observer control for every subsequent observation.
  if (observedIndex === initialIndex) return { accept: true, reconciled: true };
  return { accept: false, reconciled: false };
}
