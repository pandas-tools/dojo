"use client";

import { motion } from "motion/react";

/**
 * SuccessAtmosphere — backdrop for success-state surfaces (All set, etc.).
 *
 * Matches the Figma file (node 96:175). The Figma uses a baked-in `imgColumn`
 * image that produces a "brushed chrome" look — bright at top AND bottom,
 * dark through the middle. We approximate that in CSS with mirrored horizon
 * glows. Linear top-down still goes slate → near-black as the base layer.
 *
 * Top + bottom glows breathe in unison to keep the scene alive.
 * Reduced-motion is suppressed via the global CSS rule.
 */
export default function SuccessAtmosphere() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden bg-[#0e0e0e]"
      style={{ isolation: "isolate" }}
    >
      {/* Base linear: steel-harbor → near-black at ~32% (matches Figma) */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(180deg, #445158 0%, #0e0e0e 31.844%)",
        }}
      />

      {/* TOP horizon — mirror of the bottom one */}
      <motion.div
        className="absolute inset-x-0 top-0"
        style={{ height: "55vh" }}
        animate={{ opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 90% 100% at 50% 0%, rgba(255,255,255,0.85) 0%, rgba(219,243,255,0.7) 10%, rgba(193,232,251,0.55) 25%, rgba(159,191,207,0.3) 45%, rgba(68,81,88,0.1) 65%, transparent 82%)",
          }}
        />
      </motion.div>

      {/* BOTTOM horizon — same as the auth atmosphere */}
      <motion.div
        className="absolute inset-x-0 bottom-0"
        style={{ height: "55vh" }}
        animate={{ opacity: [0.92, 1, 0.92] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 90% 100% at 50% 100%, rgba(255,255,255,0.95) 0%, rgba(219,243,255,0.85) 10%, rgba(193,232,251,0.7) 25%, rgba(159,191,207,0.4) 45%, rgba(68,81,88,0.15) 68%, transparent 85%)",
          }}
        />
      </motion.div>

      {/* Cyan drift accent — bottom-anchored, gives subtle horizontal motion */}
      <motion.div
        className="absolute inset-x-0 bottom-0 mx-auto rounded-[100%]"
        style={{
          width: "120vw",
          height: "30vh",
          marginLeft: "-10vw",
          background: "#C1E8FB",
          filter: "blur(100px)",
          mixBlendMode: "screen",
          opacity: 0.15,
        }}
        animate={{ x: ["-3%", "3%", "-3%"] }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
