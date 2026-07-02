"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import confetti from "canvas-confetti";

const COOL_PALETTE = ["#C1E8FB", "#DBF3FF", "#FFFFFF", "#9FBFCF"];

/**
 * UpvoteBurst — soft radial glow behind the upvote button icon. TikTok-style
 * accent: pulses out from behind the icon (~72px), then fades. Pair with the
 * `.upvote-bump` class on the icon wrapper for the icon-pop. The confetti
 * origin is derived from the wrapper's DOMRect so mobile and desktop buttons
 * emit from their actual positions without hard-coded coords.
 */
export default function UpvoteBurst({ active }: { active: boolean }) {
  const firedRef = useRef(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!active) {
      firedRef.current = false;
      return;
    }
    if (firedRef.current) return;
    firedRef.current = true;
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const el = wrapperRef.current;
    let origin = { x: 0.5, y: 0.5 };
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        origin = {
          x: (r.left + r.width / 2) / window.innerWidth,
          y: (r.top + r.height / 2) / window.innerHeight,
        };
      }
    }
    confetti({
      particleCount: 8,
      startVelocity: 20,
      spread: 65,
      angle: 90,
      origin,
      colors: COOL_PALETTE,
      ticks: 70,
      scalar: 0.55,
      gravity: 0.9,
      decay: 0.92,
      shapes: ["circle"],
      disableForReducedMotion: true,
    });
  }, [active]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          ref={wrapperRef}
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(193,232,251,0.6) 0%, rgba(193,232,251,0.15) 55%, rgba(193,232,251,0) 75%)",
          }}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: [0.4, 1.15, 1], opacity: [0, 0.95, 0] }}
          transition={{
            duration: 0.6,
            times: [0, 0.4, 1],
            ease: [0.16, 1, 0.3, 1],
          }}
        />
      )}
    </AnimatePresence>
  );
}
