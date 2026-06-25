/**
 * AuthAtmosphere — backdrop for the Figma auth surfaces.
 *
 * Composition (matches Figma node 96:80):
 *   1. Linear gradient top → bottom: steel-harbor (#445158) → near-black at ~32%
 *   2. Big arctic-haze BOTTOM GLOW occupying ~55% of viewport height,
 *      brightest at the bottom-center, fades up. THIS is the brand moment —
 *      the Figma's baked-in `Subtract` asset. Approximated here in CSS.
 *
 * Slow drift on the glow gives a "dynamic but quiet" feel.
 * Reduced-motion suppresses the animation. All GPU-composited.
 */
export default function AuthAtmosphere() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden bg-[#0e0e0e]"
    >
      {/* 1. Linear top-down: steel-harbor → near-black at 31.844% */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(180deg, #445158 0%, #0e0e0e 31.844%)",
        }}
      />

      {/* 2. BOTTOM GLOW — the brand moment. Anchored to the bottom of the
            viewport, brightest at the bottom edge, fades up into the dark. */}
      <div
        className="absolute inset-x-0 bottom-0 h-[55vh] aurora-layer-a"
        style={{
          background:
            "radial-gradient(ellipse 100% 100% at 50% 100%, rgba(255,255,255,0.95) 0%, rgba(219,243,255,0.85) 8%, rgba(193,232,251,0.7) 22%, rgba(159,191,207,0.4) 42%, rgba(132,158,171,0.15) 65%, transparent 85%)",
        }}
      />

      {/* Soft outer halo — extends the glow's reach upward + sideways */}
      <div
        className="absolute inset-x-[-20%] bottom-[-10vh] h-[75vh] aurora-layer-b"
        style={{
          background:
            "radial-gradient(ellipse 70% 100% at 50% 100%, rgba(193,232,251,0.3) 0%, rgba(132,158,171,0.1) 45%, transparent 75%)",
          filter: "blur(40px)",
        }}
      />
    </div>
  );
}
