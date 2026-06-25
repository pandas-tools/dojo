"use client";

import { motion } from "motion/react";

/**
 * AuthAtmosphere — backdrop for the Figma auth surfaces.
 *
 * The horizon glow is a single wide radial gradient anchored to the bottom-
 * center of the viewport. Brightest at the bottom-center, fades up and to
 * the sides. Stops are tuned per the Figma color palette:
 *   #FFFFFF → #DBF3FF → #C1E8FB → #9FBFCF → #445158 → transparent
 *
 * Wrapped in a motion.div that breathes slowly (scale + opacity) so the
 * scene feels alive. A secondary cyan accent drifts horizontally on
 * mix-blend-mode: screen to add atmospheric motion.
 *
 * Reduced-motion is suppressed via the global CSS rule.
 */
export default function AuthAtmosphere() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden bg-[#0e0e0e]"
      style={{ isolation: "isolate" }}
    >
      {/* Linear top-down: steel-harbor → near-black at ~32% (Figma spec) */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(180deg, #445158 0%, #0e0e0e 31.844%)",
        }}
      />

      {/* HORIZON BAND — wide radial centered at the bottom, breathing */}
      <motion.div
        className="absolute inset-x-0 bottom-0"
        style={{ height: "65vh" }}
        animate={{ opacity: [0.92, 1, 0.92] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 90% 100% at 50% 100%, rgba(255,255,255,0.95) 0%, rgba(219,243,255,0.85) 10%, rgba(193,232,251,0.7) 25%, rgba(159,191,207,0.4) 45%, rgba(68,81,88,0.15) 68%, transparent 85%)",
          }}
        />
      </motion.div>

      {/* Quiet cyan accent that drifts horizontally — adds atmospheric motion
          without changing the horizon's overall shape. */}
      <motion.div
        className="absolute inset-x-0 bottom-0 mx-auto rounded-[100%]"
        style={{
          width: "120vw",
          height: "35vh",
          marginLeft: "-10vw",
          background: "#C1E8FB",
          filter: "blur(90px)",
          mixBlendMode: "screen",
          opacity: 0.18,
        }}
        animate={{ x: ["-3%", "3%", "-3%"] }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
