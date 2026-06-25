"use client";

import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";

/**
 * ConfettiBurst — fires a brand-colored confetti burst on mount. Two
 * intensities:
 *   - "lesson": one strong center burst + two side bursts ~3.5s total
 *   - "tier":   bigger, longer celebration with rolling bursts ~5s total
 *
 * Uses a pinned canvas so particles render above app chrome but below modals.
 * Respects prefers-reduced-motion (no-op when set). Cleans up on unmount.
 */
type Intensity = "lesson" | "tier";

const COOL_PALETTE = [
  "#C1E8FB", // arctic-haze
  "#DBF3FF", // glacier-whisper
  "#FFFFFF", // white
  "#9FBFCF", // frosted-fjord
  "#54646C", // steel-harbor (low-contrast accent)
];

export default function ConfettiBurst({
  intensity = "lesson",
  fireOnMount = true,
}: {
  intensity?: Intensity;
  fireOnMount?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!fireOnMount) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const fire = confetti.create(canvas, {
      resize: true,
      useWorker: true,
    });

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => {
      timers.push(setTimeout(() => !cancelled && fn(), ms));
    };

    const defaults = {
      colors: COOL_PALETTE,
      shapes: ["square" as const],
      ticks: 220,
      scalar: 1,
      gravity: 1.05,
      drift: 0,
      decay: 0.92,
    };

    if (intensity === "lesson") {
      // Center burst, then two angled side bursts for layering.
      fire({
        ...defaults,
        particleCount: 110,
        spread: 70,
        startVelocity: 48,
        origin: { x: 0.5, y: 0.45 },
      });
      at(220, () =>
        fire({
          ...defaults,
          particleCount: 60,
          angle: 60,
          spread: 55,
          startVelocity: 42,
          origin: { x: 0, y: 0.55 },
        }),
      );
      at(260, () =>
        fire({
          ...defaults,
          particleCount: 60,
          angle: 120,
          spread: 55,
          startVelocity: 42,
          origin: { x: 1, y: 0.55 },
        }),
      );
    } else {
      // Tier — longer, rolling.
      fire({
        ...defaults,
        particleCount: 140,
        spread: 90,
        startVelocity: 55,
        origin: { x: 0.5, y: 0.45 },
      });
      at(180, () =>
        fire({
          ...defaults,
          particleCount: 70,
          angle: 60,
          spread: 70,
          startVelocity: 48,
          origin: { x: 0, y: 0.5 },
        }),
      );
      at(220, () =>
        fire({
          ...defaults,
          particleCount: 70,
          angle: 120,
          spread: 70,
          startVelocity: 48,
          origin: { x: 1, y: 0.5 },
        }),
      );
      at(900, () =>
        fire({
          ...defaults,
          particleCount: 90,
          spread: 100,
          startVelocity: 45,
          origin: { x: 0.5, y: 0.35 },
        }),
      );
      at(1700, () =>
        fire({
          ...defaults,
          particleCount: 60,
          spread: 110,
          startVelocity: 40,
          origin: { x: 0.5, y: 0.4 },
        }),
      );
    }

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      fire.reset();
    };
  }, [intensity, fireOnMount]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-30 h-full w-full"
    />
  );
}
