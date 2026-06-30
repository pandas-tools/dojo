"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import TierProgressPopup, { type TierStanding } from "./TierProgressPopup";

/**
 * TierStrip — compact tier-progress pill at the top of Library / Bookmark.
 * Matches Figma node 109:1536. Glass pill with tier marker + current tier
 * label + lessons-to-next hint. Tap opens the TierProgressPopup overlay.
 */
export default function TierStrip({
  currentTier,
  nextTierLabel,
  lessonsToNext,
  tiers,
  completed,
  total,
  className,
}: {
  currentTier: TierStanding;
  nextTierLabel?: string;
  lessonsToNext?: number;
  tiers: TierStanding[];
  completed: number;
  total: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex w-full items-center justify-between rounded-[8px] border border-white/15 bg-[rgba(14,14,14,0.4)] px-5 py-2 text-[#f9fdff] backdrop-blur-md transition-colors hover:bg-[rgba(14,14,14,0.55)]",
          className,
        )}
      >
        <div className="flex flex-1 items-center gap-2">
          <span
            aria-hidden
            className="inline-flex h-[14px] w-[14px] items-center justify-center rounded-sm bg-arctic-haze text-[8px] text-near-black"
          >
            ✦
          </span>
          <span className="text-[13px] font-medium leading-[1.2] text-[#f9fdff]">
            You are {currentTier.name}
          </span>
          {typeof lessonsToNext === "number" && lessonsToNext > 0 && nextTierLabel && (
            <span className="ml-auto pr-2 text-[10px] font-medium leading-[1.2] text-[#f9fdff]/70">
              {lessonsToNext} lessons to {nextTierLabel}
            </span>
          )}
        </div>
        <ChevronRight
          className="h-3.5 w-3.5 text-[#f9fdff]/70"
          strokeWidth={2.5}
          aria-hidden
        />
      </button>

      <TierProgressPopup
        open={open}
        onOpenChange={setOpen}
        tiers={tiers}
        currentTierId={currentTier.id}
        completed={completed}
        total={total}
        lessonsToNext={lessonsToNext}
        ctaLabel={
          lessonsToNext && lessonsToNext > 0 ? "Keep going!" : "Browse lessons"
        }
      />
    </>
  );
}
