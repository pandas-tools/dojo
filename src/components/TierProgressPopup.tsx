"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * TierProgressPopup — modal showing the user's tier ladder + a progress bar
 * to the next tier. Matches the Figma file (node 122:3489 — Library_Progress
 * Popup). Triggered from the TierStrip pill in the header of /browse and
 * /saved.
 *
 * NOTE: Figma uses emerald (#00c9a7) accents for the CURRENT tier ring + CTA.
 * This codebase's brand directive is "strictly cool palette" (see persona
 * memory feedback_pandas_palette_is_strictly_cool). I've swapped the emerald
 * for arctic-haze so the popup ships brand-safe. If Dimi confirms emerald is
 * the new direction, swap the `ACCENT_*` constants below.
 */
const ACCENT_BG_FROM = "#C1E8FB"; // arctic-haze (was #00C9A7 emerald in Figma)
const ACCENT_BG_TO = "#54646C"; // steel-harbor (was #006353 deep teal)
const ACCENT_RING = "rgba(193,232,251,0.6)"; // (was rgba(0,201,167,0.6))
const ACCENT_GLOW = "rgba(193,232,251,0.25)"; // (was rgba(0,201,167,0.2))

export type TierStanding = {
  id: string;
  name: string;
};

export default function TierProgressPopup({
  open,
  onOpenChange,
  tiers,
  currentTierId,
  completed,
  total,
  lessonsToNext,
  ctaLabel = "Keep going!",
  trigger,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  tiers: TierStanding[];
  currentTierId: string;
  completed: number;
  total: number;
  lessonsToNext?: number;
  ctaLabel?: string;
  trigger?: ReactNode;
}) {
  const currentIdx = tiers.findIndex((t) => t.id === currentTierId);
  // Always show up to 3 tiers, centered on the current when possible.
  // Edge: current at idx 0 → [0,1,2]; current at last idx → [n-3,n-2,n-1].
  const targetCount = Math.min(3, tiers.length);
  const start =
    currentIdx < 0
      ? 0
      : Math.max(0, Math.min(currentIdx - 1, tiers.length - targetCount));
  const visibleTiers = tiers.slice(start, start + targetCount).map((t) => {
    const tierIdx = tiers.findIndex((x) => x.id === t.id);
    return {
      ...t,
      position: (tierIdx < currentIdx
        ? "past"
        : tierIdx === currentIdx
          ? "current"
          : "future") as "past" | "current" | "future",
    };
  });
  const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50 bg-[rgba(14,14,14,0.6)] backdrop-blur-[4px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[338px] -translate-x-1/2 -translate-y-1/2 rounded-[40px] border border-[rgba(193,232,251,0.56)] px-6 pb-10 pt-[72px] shadow-[0px_-16px_40px_0px_rgba(193,232,251,0.2),0px_-24px_60px_0px_rgba(0,0,0,0.5)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0"
          style={{
            backgroundImage:
              "linear-gradient(90deg, #0e0e0e 0%, rgba(68,81,88,0.2) 100%), linear-gradient(90deg, #0e0e0e 0%, #0e0e0e 100%)",
          }}
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Tier progress</Dialog.Title>

          <div className="flex flex-col gap-8">
            {/* Tier ladder row — equal-width slots so current sits visually
                centered in its column regardless of edge position. */}
            <div className="grid grid-cols-3 items-center">
              {visibleTiers.map((t) => (
                <div key={t.id} className="flex justify-center">
                  <TierCircle name={t.name} variant={t.position} />
                </div>
              ))}
            </div>

            {/* Progress section */}
            <div className="flex flex-col items-center gap-4 px-6">
              <p className="text-[28px] font-medium leading-none text-[#f9fafb]">
                <span>{completed}</span>
                <span className="text-[#91aebc]"> / {total}</span>
              </p>
              <div className="relative h-[20px] w-full overflow-hidden rounded-[10px] bg-[rgba(68,81,88,0.3)]">
                <div
                  className="absolute inset-y-0 left-0 rounded-[10px] transition-[width] duration-500 ease-out"
                  style={{
                    width: `${pct}%`,
                    background: ACCENT_BG_FROM,
                    boxShadow: `0 0 12px 0 ${ACCENT_GLOW}`,
                  }}
                />
              </div>
              <p className="text-[12px] leading-4 text-[#91aebc]">
                {lessonsToNext && lessonsToNext > 0
                  ? `Almost there! Just ${lessonsToNext} more to go 🚀`
                  : "You've completed every lesson — nice work."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenChange?.(false)}
            className="mt-[72px] flex h-[56px] w-full items-center justify-center rounded-[28px] text-[16px] font-medium leading-[1.3] text-[#f9fdff] shadow-[0px_0px_18px_0px_rgba(193,232,251,0.2),0px_10px_24px_0px_rgba(193,232,251,0.2)] transition-opacity hover:opacity-90"
            style={{
              backgroundImage: `linear-gradient(90deg, ${ACCENT_BG_FROM} 0%, ${ACCENT_BG_TO} 100%)`,
              color: "#0e0e0e",
            }}
          >
            {ctaLabel}
          </button>

          <Dialog.Close
            aria-label="Close"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function TierCircle({
  name,
  variant,
}: {
  name: string;
  variant: "past" | "current" | "future";
}) {
  const isCurrent = variant === "current";
  const size = isCurrent ? "h-20 w-20" : "h-16 w-16";
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2",
        variant === "future" && "opacity-50",
      )}
      style={{ width: isCurrent ? 100 : 80 }}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-[40px] border-2",
          size,
        )}
        style={
          isCurrent
            ? {
                borderColor: ACCENT_RING,
                backgroundImage:
                  "linear-gradient(90deg, rgba(193,232,251,0.1) 0%, rgba(193,232,251,0.1) 100%), linear-gradient(90deg, #1B1F20 0%, #1B1F20 100%)",
                boxShadow: `0 0 9px 0 rgba(193,232,251,0.15), 0 12px 12px 0 ${ACCENT_GLOW}`,
              }
            : {
                background: "#0e0e0e",
                borderColor: "#445158",
              }
        }
      >
        <span className="text-2xl" aria-hidden>
          {tierGlyph(name)}
        </span>
      </div>
      <p
        className={cn(
          "text-[12px] leading-4",
          isCurrent
            ? "font-medium text-[#f9fdff]"
            : "text-[#91aebc]",
        )}
      >
        {name}
      </p>
    </div>
  );
}

function tierGlyph(name: string) {
  const k = name.toLowerCase();
  if (k.includes("appren") || k.includes("white")) return "🥋";
  if (k.includes("special") || k.includes("blue")) return "🌊";
  if (k.includes("expert") || k.includes("black")) return "🥇";
  if (k.includes("master") || k.includes("brown")) return "🏆";
  return "⭐";
}
