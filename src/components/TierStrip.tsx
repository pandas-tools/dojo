"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import TierProgressPopup, { type TierStanding } from "./TierProgressPopup";
import TierEmoji from "./TierEmoji";

/**
 * TierStrip — compact tier-progress pill at the top of Library / Bookmark.
 * Matches Figma node 109:1536. The Apprentice/Specialist/Expert icon at
 * left mirrors the user's CURRENT tier (Figma uses the same emblem assets
 * as the popup, just at 14px). Tap opens the TierProgressPopup overlay.
 */
export default function TierStrip({
  currentTier,
  nextTierLabel,
  lessonsToNext,
  tiers,
  completed,
  total,
  ctaHref,
  className,
}: {
  currentTier: TierStanding;
  nextTierLabel?: string;
  lessonsToNext?: number;
  tiers: TierStanding[];
  completed: number;
  total: number;
  /** Route the TierProgressPopup CTA navigates to (typically /watch/[id]). */
  ctaHref?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "tier-cta-shimmer flex w-full items-center justify-between rounded-full border border-white/15 px-5 py-2 text-[#f9fdff] backdrop-blur-md transition-colors hover:border-[color:var(--color-arctic-haze)]/30",
          className,
        )}
        style={{
          backgroundImage:
            "linear-gradient(90deg, #00C9A7 0%, #006353 50%, #00C9A7 100%)",
        }}
      >
        <div className="flex flex-1 items-center gap-2">
          <TierEmoji
            emoji={currentTier.emoji}
            play
            className="h-4 w-4 shrink-0"
          />
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
        ctaHref={ctaHref}
      />
    </>
  );
}
