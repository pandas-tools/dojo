"use client";

import { motion } from "motion/react";

/**
 * AuthAtmosphere — backdrop for the Figma auth surfaces.
 *
 * Based on the 21st.dev `glow-horizon` pattern (stacked blurred ellipses).
 * Localized glow sphere anchored to the bottom-center, mostly off-screen
 * so only the bright top arc shows. Matches the Figma's `Subtract` image
 * asset — a contained round halo, NOT a full-screen wash.
 *
 * Whole halo breathes slowly; reduced-motion suppresses via global CSS.
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

      {/* HORIZON SPHERE — localized round halo at the bottom-center.
            Container is 60vh × 60vh, anchored so its CENTER sits at the
            viewport's bottom edge (only the top half shows as the arc). */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          width: "60vh",
          height: "60vh",
          bottom: "-30vh",
        }}
        animate={{ scale: [1, 1.04, 1], opacity: [0.92, 1, 0.92] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Dark falloff ring (outermost — softens the halo's outer edge into bg) */}
        <Arc color="#0e0e0e" scale={1.3} blur={50} />

        {/* Steel-harbor cool base */}
        <Arc color="#445158" scale={1.15} blur={40} />

        {/* Arctic-haze halo */}
        <Arc color="#C1E8FB" scale={0.95} blur={32} opacity={0.85} />

        {/* Glacier-whisper inner ring */}
        <Arc color="#DBF3FF" scale={0.7} blur={24} opacity={0.9} />

        {/* White core — small + bright */}
        <Arc color="#FFFFFF" scale={0.4} blur={20} opacity={0.95} />
      </motion.div>

      {/* Quiet secondary halo drifting horizontally for atmospheric motion */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 rounded-full"
        style={{
          width: "70vh",
          height: "30vh",
          bottom: "-10vh",
          background: "#C1E8FB",
          filter: "blur(80px)",
          mixBlendMode: "screen",
          opacity: 0.18,
        }}
        animate={{ x: ["-4%", "4%", "-4%"] }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

function Arc({
  color,
  scale,
  blur,
  opacity = 1,
}: {
  color: string;
  scale: number;
  blur: number;
  opacity?: number;
}) {
  return (
    <div
      aria-hidden
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{
        width: "100%",
        height: "100%",
        scale,
        background: color,
        filter: `blur(${blur}px)`,
        opacity,
      }}
    />
  );
}
