"use client";

import { cn } from "@/lib/cn";

/**
 * StepProgress — 3-segment progress indicator used at the top of the
 * onboarding wizard. Each segment is a pill that fills with the brand color
 * as the user advances. Filled state slides under the active segment so the
 * progression reads as a single connected motion rather than three on/off
 * lights.
 */
export default function StepProgress({
  current,
  total = 3,
  className,
}: {
  current: number;
  total?: number;
  className?: string;
}) {
  return (
    <div
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={`Step ${current} of ${total}`}
      className={cn("flex w-full items-center gap-1.5", className)}
    >
      {Array.from({ length: total }, (_, i) => {
        const idx = i + 1;
        const filled = idx <= current;
        return (
          <span
            key={idx}
            className={cn(
              "h-1 flex-1 rounded-full transition-[background-color,opacity] duration-500 ease-out",
              filled ? "bg-arctic-haze" : "bg-white/12",
            )}
            style={{ transitionDelay: filled ? `${(idx - 1) * 80}ms` : "0ms" }}
          />
        );
      })}
    </div>
  );
}
