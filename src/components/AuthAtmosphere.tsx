"use client";

import { motion } from "motion/react";

/**
 * AuthAtmosphere — backdrop for the Figma auth surfaces.
 *
 * The Figma file has a wide HORIZONTAL bright band at the bottom of the
 * screen (like a horizon at sunrise) — not a localized halo. This rebuild
 * matches that: a wide flat glow that spans the full viewport width and
 * fades upward into the dark.
 *
 * Built as stacked WIDE+FLAT blurred ellipses (per the 21st.dev
 * glow-horizon pattern) instead of round circles, so the result is a band
 * not a halo. Brightest at the bottom-center, fades out radially.
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

      {/* HORIZON BAND — wide flat ellipses stacked at the bottom.
            Container is 150vw wide × 70vh tall, anchored with bottom -25vh
            so the brightest part sits in the lower third of the viewport. */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          width: "150vw",
          height: "70vh",
          bottom: "-25vh",
        }}
        animate={{ scale: [1, 1.025, 1], opacity: [0.92, 1, 0.92] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Dark falloff (outer edge softens halo into bg) */}
        <Ellipse color="#0e0e0e" scaleX={1.2} scaleY={1.3} blur={60} />

        {/* Steel-harbor cool base */}
        <Ellipse color="#445158" scaleX={1} scaleY={1.1} blur={50} />

        {/* Arctic-haze haze */}
        <Ellipse color="#9FBFCF" scaleX={0.85} scaleY={0.9} blur={40} opacity={0.9} />

        {/* Glacier-whisper bright haze */}
        <Ellipse color="#DBF3FF" scaleX={0.6} scaleY={0.7} blur={32} opacity={0.85} />

        {/* White core — wide oval, hugs the bottom */}
        <Ellipse color="#FFFFFF" scaleX={0.45} scaleY={0.45} blur={28} opacity={0.7} />
      </motion.div>

      {/* Soft horizontal accent — drifts slowly for atmospheric motion */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 rounded-[100%]"
        style={{
          width: "120vw",
          height: "30vh",
          bottom: "-10vh",
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

function Ellipse({
  color,
  scaleX,
  scaleY,
  blur,
  opacity = 1,
}: {
  color: string;
  scaleX: number;
  scaleY: number;
  blur: number;
  opacity?: number;
}) {
  return (
    <div
      aria-hidden
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[100%]"
      style={{
        width: "100%",
        height: "100%",
        transform: `translate(-50%, -50%) scale(${scaleX}, ${scaleY})`,
        background: color,
        filter: `blur(${blur}px)`,
        opacity,
      }}
    />
  );
}
