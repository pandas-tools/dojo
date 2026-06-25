"use client";

import { motion } from "motion/react";

/**
 * AuthAtmosphere — backdrop for the Figma auth surfaces.
 *
 * Built around the "glow horizon" idea: a bright horizon line of light at the
 * bottom of the viewport, bleeding upward through white → arctic-haze → dark.
 * Like a sunrise viewed through the screen. The horizon breathes slowly, and
 * a secondary blob drifts horizontally to give the scene quiet life.
 *
 * Matches the Figma file's intent (node 96:80): the Figma uses a baked-in
 * `Subtract` image asset to create this glow; we approximate in CSS using
 * stacked radial gradients with `mix-blend-mode: screen` for depth.
 *
 * Reduced-motion suppresses both animations via the global CSS rule.
 */
export default function AuthAtmosphere() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden bg-[#0e0e0e]"
    >
      {/* 1. Linear top-down — steel-harbor → near-black at ~32% (Figma spec) */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(180deg, #445158 0%, #0e0e0e 31.844%)",
        }}
      />

      {/* 2. THE HORIZON — bright bottom-edge sweep that defines the brand
            moment. Three stacked radial gradients build depth:
              - A sharp white core glowing at the bottom edge (the "horizon line")
              - An arctic-haze haze above it
              - A wider muted bleed to soften the falloff */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0.85 }}
        animate={{ opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
        style={{
          backgroundImage: [
            // The core — bright white at the very bottom, fades quickly
            "radial-gradient(ellipse 65% 35% at 50% 100%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 70%)",
            // The cyan haze — arctic-haze bleeding upward
            "radial-gradient(ellipse 85% 60% at 50% 100%, rgba(193,232,251,0.6) 0%, rgba(193,232,251,0) 65%)",
            // The outer bleed — muted to extend the glow's reach
            "radial-gradient(ellipse 120% 80% at 50% 100%, rgba(159,191,207,0.35) 0%, rgba(159,191,207,0) 70%)",
          ].join(", "),
        }}
      />

      {/* 3. Drifting accent blob — a softer cyan halo that drifts horizontally
            to give the static gradient a quiet pulse of motion. Screen blend
            so it adds light rather than overpainting. */}
      <motion.div
        className="absolute"
        initial={{ x: "-8%" }}
        animate={{ x: ["-8%", "8%", "-8%"] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        style={{
          left: "10%",
          right: "10%",
          bottom: "-15%",
          height: "55%",
          mixBlendMode: "screen",
          backgroundImage:
            "radial-gradient(ellipse 55% 80% at 50% 100%, rgba(219,243,255,0.55) 0%, rgba(193,232,251,0.2) 35%, rgba(193,232,251,0) 70%)",
          filter: "blur(20px)",
        }}
      />
    </div>
  );
}
