/**
 * AuthAtmosphere — backdrop for the Figma onboarding/auth surfaces (login,
 * language, store). Matches the Figma file (node 96:80):
 *   - Linear top-down gradient: steel-harbor (#445158) → near-black at 31.844%
 *   - 20% black flatten overlay
 *   - Bottom cyan glow approximating the baked-in `Subtract` image asset.
 *     The glow is the BRAND moment — bright arctic-haze sweeping up from the
 *     bottom-center, soft & wide. Slow drift gives life. GPU-composited,
 *     auto-suppressed by prefers-reduced-motion.
 */
export default function AuthAtmosphere() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Base: steel-harbor → near-black linear (matches Figma exactly) */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(180deg, #445158 0%, #0e0e0e 31.844%)",
        }}
      />
      {/* 20% black flatten overlay (Figma applies this on top of the linear) */}
      <div className="absolute inset-0 bg-[rgba(14,14,14,0.2)]" />

      {/* Bottom glow — the brand moment. Bright arctic-haze sweep from
          bottom-center, large enough to be the dominant element of the lower
          half. Sized in vmin so it scales with the smaller viewport dimension
          (works on mobile portrait AND desktop wide). */}
      <div
        className="aurora-layer-a absolute left-1/2 -translate-x-1/2"
        style={{
          bottom: "-25vmin",
          width: "180vmin",
          height: "90vmin",
          background:
            "radial-gradient(ellipse 50% 70% at 50% 100%, rgba(255,255,255,0.95) 0%, rgba(219,243,255,0.85) 12%, rgba(193,232,251,0.7) 28%, rgba(159,191,207,0.35) 50%, rgba(132,158,171,0.12) 68%, transparent 82%)",
          filter: "blur(2px)",
        }}
      />

      {/* Secondary diffusion — softer outer halo to extend the glow's reach */}
      <div
        className="aurora-layer-b absolute left-1/2 -translate-x-1/2"
        style={{
          bottom: "-10vmin",
          width: "220vmin",
          height: "70vmin",
          background:
            "radial-gradient(ellipse 60% 80% at 50% 100%, rgba(193,232,251,0.45) 0%, rgba(132,158,171,0.18) 40%, transparent 70%)",
          filter: "blur(30px)",
        }}
      />
    </div>
  );
}
