import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * TierStrip — compact tier-progress pill at the top of Library / Bookmark.
 * Matches Figma node 109:1536. Glass pill with the tier marker, current
 * tier label, and a "X lessons to next" hint. Tappable to expand into the
 * full tier hero (currently routes to /profile where the detail lives).
 */
export default function TierStrip({
  currentTierLabel,
  nextTierLabel,
  lessonsToNext,
  href = "/profile",
  className,
}: {
  currentTierLabel: string;
  nextTierLabel?: string;
  lessonsToNext?: number;
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
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
          You are {currentTierLabel}
        </span>
        {typeof lessonsToNext === "number" && nextTierLabel && (
          <span className="ml-auto pr-2 text-[10px] font-medium leading-[1.2] text-[#f9fdff]/70">
            {lessonsToNext} lessons to {nextTierLabel}
          </span>
        )}
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-[#f9fdff]/70" strokeWidth={2.5} aria-hidden />
    </Link>
  );
}
