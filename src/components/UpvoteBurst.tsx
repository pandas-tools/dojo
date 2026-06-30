"use client";

import { AnimatePresence, motion } from "motion/react";

/**
 * UpvoteBurst — celebratory burst that plays once when the user upvotes a
 * lesson. Matches the Figma file (node 137:1291 — Upvote). Figma uses an
 * infinite-loop demo; in production we play once on upvote and unmount.
 *
 * Motion params straight from Figma's get_motion_context:
 *   rotate: [-37.66°, -17.66°, -17.66°] — wind-up then settle
 *   scaleX/Y: [0, 1, 1] — punch in then hold
 *   ease in: cubic-bezier(0.5, 0, 0.5, 1)
 * Plus an exit fade so it doesn't linger.
 *
 * Reduced-motion: AnimatePresence respects prefers-reduced-motion via the
 * global CSS rule that zeros all animation durations.
 */
export default function UpvoteBurst({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 z-30 h-[290px] w-[290px] -translate-x-1/2 -translate-y-1/2"
          initial={{ rotate: -37.66, scale: 0, opacity: 1 }}
          animate={{ rotate: -17.66, scale: 1, opacity: 1 }}
          exit={{ rotate: -17.66, scale: 1.05, opacity: 0 }}
          transition={{
            rotate: { duration: 0.45, ease: [0.5, 0, 0.5, 1] },
            scale: { duration: 0.45, ease: [0.876, 0, 1, 1] },
            opacity: { duration: 0.4 },
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/img/lesson/upvote-burst.svg"
            alt=""
            className="h-full w-full"
            draggable={false}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
