"use client";

import { cn } from "@/lib/cn";

/**
 * StepProgress — 3-segment progress indicator at the top of the auth/onboarding
 * surfaces. Matches the Figma file (image asset `Frame 1000004367/8`):
 *   - 4px tall pills, equal flex
 *   - Active = arctic-haze, past = muted arctic-haze, future = low-opacity
 *   - 12px gap between segments
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
      className={cn("flex w-full items-center gap-3", className)}
    >
      {Array.from({ length: total }, (_, i) => {
        const idx = i + 1;
        const isPast = idx < current;
        const isCurrent = idx === current;
        return (
          <span
            key={idx}
            className={cn(
              "h-1 flex-1 rounded-full transition-[background-color,opacity] duration-500 ease-out",
              isCurrent && "bg-[#c1e8fb]",
              isPast && "bg-[#c1e8fb]/65",
              !isPast && !isCurrent && "bg-white/15",
            )}
            style={{ transitionDelay: idx <= current ? `${(idx - 1) * 80}ms` : "0ms" }}
          />
        );
      })}
    </div>
  );
}
