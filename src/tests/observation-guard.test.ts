// Unit tests for the pure `reconcileObservation` guard — the decision that
// keeps a stray "top of container" IntersectionObserver reading from stealing
// activeIndex off the deep-link target during the mobile-Safari mount-scroll
// race (title flicker + URL rewrite + black autoplay cold-start).

import { describe, expect, it } from "vitest";
import { reconcileObservation } from "@/app/watch/[id]/observationGuard";

describe("reconcileObservation", () => {
  it("ignores a stray non-target observation before reconciling", () => {
    // iOS Safari reports section 0 before the scroll to target (3) settles.
    expect(
      reconcileObservation({
        observedIndex: 0,
        initialIndex: 3,
        reconciled: false,
      }),
    ).toEqual({ accept: false, reconciled: false });
  });

  it("accepts and reconciles once the target itself settles", () => {
    expect(
      reconcileObservation({
        observedIndex: 3,
        initialIndex: 3,
        reconciled: false,
      }),
    ).toEqual({ accept: true, reconciled: true });
  });

  it("drives freely for any section after reconciling", () => {
    expect(
      reconcileObservation({
        observedIndex: 1,
        initialIndex: 3,
        reconciled: true,
      }),
    ).toEqual({ accept: true, reconciled: true });
  });

  it("is a no-op when the deep-link target is the first section", () => {
    // initialIndex === 0: the very first observation reconciles, so behaviour
    // matches the pre-fix code — deep-links to lesson 0 never repro'd.
    expect(
      reconcileObservation({
        observedIndex: 0,
        initialIndex: 0,
        reconciled: false,
      }),
    ).toEqual({ accept: true, reconciled: true });
  });

  it("stays reconciled even if a later stray reading matches the target", () => {
    // Once handed over, the guard never re-arms — the user is in control.
    expect(
      reconcileObservation({
        observedIndex: 3,
        initialIndex: 3,
        reconciled: true,
      }),
    ).toEqual({ accept: true, reconciled: true });
  });
});
