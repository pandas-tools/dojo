"use client";

import Aurora from "@/components/Aurora";

/**
 * SuccessAtmosphere — backdrop for success-state surfaces (All set, etc.).
 *
 * WebGL aurora gradient (reactbits aurora shader) over a near-black base.
 * Colors are the Pandas cool palette: ice (#C1E8FB) → steel-harbor (#445158).
 * Auto-pauses on prefers-reduced-motion.
 */
export default function SuccessAtmosphere() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden bg-[#0e0e0e]"
      style={{ isolation: "isolate" }}
    >
      <Aurora
        colorStops={["#C1E8FB", "#445158", "#445158"]}
        blend={0.64}
        amplitude={1.0}
        speed={0.9}
      />
    </div>
  );
}
