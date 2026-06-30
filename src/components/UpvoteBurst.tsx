"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import confetti from "canvas-confetti";

const COOL_PALETTE = ["#C1E8FB", "#DBF3FF", "#FFFFFF", "#9FBFCF"];

/**
 * UpvoteBurst — celebratory overlay that plays once when the user upvotes.
 * Built around the Figma asset (node 137:1291) but tuned for energy:
 *   - Spring overshoot scale-in (lands ~115% then settles to 100%)
 *   - Brief secondary pulse (1.0 → 1.06 → 1.0) at 220ms for liveliness
 *   - 360° rotation continues subtly during the fade-out
 *   - Small canvas-confetti puff fired from the heart position to add
 *     particle energy alongside the SVG burst
 *
 * Total beat: ~900ms. Reduced-motion is suppressed via the global CSS
 * rule that zeros all animation durations; canvas-confetti also exits
 * early on prefers-reduced-motion.
 */
export default function UpvoteBurst({ active }: { active: boolean }) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!active) {
      firedRef.current = false;
      return;
    }
    if (firedRef.current) return;
    firedRef.current = true;
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    // Two quick puffs from the heart-button position (right ~88%, bottom ~25%).
    // Adds particle energy on top of the SVG burst.
    const origin = { x: 0.88, y: 0.78 };
    confetti({
      particleCount: 18,
      startVelocity: 32,
      spread: 60,
      angle: 100,
      origin,
      colors: COOL_PALETTE,
      ticks: 100,
      scalar: 0.85,
      gravity: 0.7,
      decay: 0.93,
      shapes: ["circle", "square"],
      disableForReducedMotion: true,
    });
    window.setTimeout(() => {
      confetti({
        particleCount: 14,
        startVelocity: 28,
        spread: 90,
        angle: 110,
        origin,
        colors: COOL_PALETTE,
        ticks: 90,
        scalar: 0.7,
        gravity: 0.7,
        decay: 0.93,
        shapes: ["circle"],
        disableForReducedMotion: true,
      });
    }, 80);
  }, [active]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 z-30 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2"
          initial={{ rotate: -47, scale: 0, opacity: 0.9 }}
          animate={{
            rotate: [-47, -17, -12, -16],
            scale: [0, 1.18, 0.96, 1.06, 1],
            opacity: [0.9, 1, 1, 1, 1],
          }}
          exit={{ rotate: 0, scale: 1.15, opacity: 0 }}
          transition={{
            rotate: {
              duration: 0.5,
              times: [0, 0.35, 0.6, 1],
              ease: [0.16, 1, 0.3, 1],
            },
            scale: {
              duration: 0.55,
              times: [0, 0.35, 0.55, 0.75, 1],
              ease: [0.16, 1, 0.3, 1],
            },
            opacity: { duration: 0.45, ease: "linear" },
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/img/lesson/upvote-burst.svg"
            alt=""
            className="h-full w-full drop-shadow-[0_0_24px_rgba(193,232,251,0.45)]"
            draggable={false}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
