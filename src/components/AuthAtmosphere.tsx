"use client";

import { motion } from "motion/react";

/**
 * AuthAtmosphere — backdrop for the Figma auth surfaces.
 *
 * Bottom dome glow per the Figma reference: a CONTAINED bright focal
 * point at bottom-center that falls off into dark, not a wide horizon
 * wash across the whole bottom. Anchors the brand moment without lifting
 * the rest of the page into a gray haze.
 *
 * Stops use the Pandas cool palette:
 *   #FFFFFF → #DBF3FF → #C1E8FB → #9FBFCF → near-black → transparent
 *
 * Slow opacity breathe keeps it alive. Reduced-motion is suppressed via
 * the global CSS rule.
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

      {/* BOTTOM DOME GLOW — contained focal point at bottom-center.
            Narrower ellipse (55% width vs prior 90%) so the glow doesn't
            wash horizontally; harder falloff so the surrounding area stays
            properly dark instead of bleeding into gray haze. */}
      <motion.div
        className="absolute inset-x-0 bottom-0 h-[55vh] aurora-layer-a"
        style={{
          background:
            "radial-gradient(ellipse 55% 90% at 50% 100%, rgba(255,255,255,0.95) 0%, rgba(219,243,255,0.8) 14%, rgba(193,232,251,0.5) 32%, rgba(159,191,207,0.18) 55%, rgba(68,81,88,0.05) 75%, transparent 90%)",
        }}
        animate={{ opacity: [0.92, 1, 0.92] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
