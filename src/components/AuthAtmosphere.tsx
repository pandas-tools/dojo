/**
 * AuthAtmosphere — backdrop for the Figma onboarding/auth surfaces (login,
 * language, store). Matches the Figma file (node 96:80) which uses a linear
 * top-down gradient (steel-harbor → near-black at ~32%) plus a baked-in
 * bottom cyan glow image (`Subtract`). We approximate the Subtract glow with
 * a layered radial gradient — same shape and intensity, no asset fetch.
 *
 * The bottom glow gets a slow drift so the screen reads as "dynamic" without
 * any element actually moving fast enough to distract from the form.
 * GPU-composited; auto-suppressed by prefers-reduced-motion.
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

      {/* Bottom glow — approximates the Subtract image asset.
          A bright cyan ellipse that sweeps up from the bottom-center,
          softens into arctic-haze, then fades. Slow drift gives life. */}
      <div
        className="aurora-layer-a absolute -bottom-[10%] left-1/2 h-[55%] w-[180%] -translate-x-1/2"
        style={{
          background:
            "radial-gradient(ellipse 50% 70% at 50% 100%, rgba(249,253,255,0.85) 0%, rgba(193,232,251,0.55) 25%, rgba(132,158,171,0.18) 55%, transparent 78%)",
          filter: "blur(8px)",
        }}
      />

      {/* Secondary, smaller bottom-right hint — adds depth + drift counterpoint */}
      <div
        className="aurora-layer-b absolute -bottom-[5%] right-[-10%] h-[35%] w-[80%]"
        style={{
          background:
            "radial-gradient(ellipse 60% 80% at 60% 100%, rgba(193,232,251,0.25) 0%, transparent 70%)",
          filter: "blur(20px)",
        }}
      />
    </div>
  );
}
