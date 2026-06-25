"use client";

import { motion } from "motion/react";

/**
 * AuthAtmosphere — backdrop for the Figma auth surfaces.
 *
 * Built from the 21st.dev `glow-horizon` pattern (ahammed_bashar) — stacked
 * blurred circles/ellipses, not radial-gradient stops. The blurred edges of
 * each layer ARE the glow. Centered+bottom-anchored produces the localized
 * "round halo near the bottom" that the Figma file shows (a baked-in
 * `Subtract` image asset; we approximate in CSS).
 *
 * Colors are the Pandas brand cool palette (white + arctic-haze + steel-
 * harbor) instead of the reference's violet. The whole halo breathes
 * slowly; reduced-motion suppresses via the global CSS rule.
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

      {/* HORIZON — stacked blurred ellipses, breathing in place.
            Layers go from largest+darkest (back) to smallest+brightest (front).
            Each ellipse is positioned with its lower half off-screen below the
            viewport so we see the rounded TOP of the halo. */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 bottom-[-40%] aspect-square w-[120%]"
        animate={{ scale: [1, 1.04, 1], opacity: [0.92, 1, 0.92] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Dark falloff ring (innermost, darkest — softens edges into bg) */}
        <Arc color="#0e0e0e" size="120%" blur={60} />

        {/* Steel-harbor — muted cool base */}
        <Arc color="#445158" size="115%" blur={45} />

        {/* Arctic-haze haze — the brand color */}
        <Arc color="#9FBFCF" size="98%" blur={32} />

        {/* Glacier whisper — bright cyan-white core */}
        <Arc color="#DBF3FF" size="78%" blur={26} />

        {/* White core w/ glow box-shadow */}
        <Arc
          color="#FFFFFF"
          size="56%"
          blur={18}
          boxShadow="0 -8px 60px 10px rgba(255,255,255,0.45)"
        />
      </motion.div>

      {/* Quiet horizontal drift — extra cyan accent that slides slowly, screen
          blend so it adds light without overpainting */}
      <motion.div
        className="absolute left-1/2 bottom-[-20%] aspect-[2/1] w-[80%] -translate-x-1/2 rounded-full"
        style={{
          background: "#C1E8FB",
          filter: "blur(80px)",
          mixBlendMode: "screen",
          opacity: 0.35,
        }}
        animate={{ x: ["-6%", "6%", "-6%"] }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

function Arc({
  color,
  size,
  blur,
  boxShadow,
}: {
  color: string;
  size: string;
  blur: number;
  boxShadow?: string;
}) {
  const scale = parseFloat(size) / 100;
  return (
    <div
      aria-hidden
      className="absolute inset-0 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{
        width: "100%",
        height: "100%",
        scale,
        background: color,
        filter: `blur(${blur}px)`,
        ...(boxShadow && { boxShadow }),
      }}
    />
  );
}
