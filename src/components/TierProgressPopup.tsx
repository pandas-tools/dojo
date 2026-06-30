"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import TierIcon from "./TierIcon";

/**
 * TierProgressPopup — modal showing the user's tier ladder + a progress bar
 * to the next tier. Matches the Figma file (node 122:3489 — Library_Progress
 * Popup). Triggered from the TierStrip pill in /browse and /saved.
 *
 * Color treatment: the Figma uses emerald (#00C9A7 → #006353) for the
 * active tier ring + CTA gradient. We honor that here per Dimi's direction;
 * the progress bar fill itself stays arctic-haze (Figma keeps it cyan with
 * just the emerald glow shadow).
 */
const ACCENT = "#00C9A7"; // emerald — Figma's tier accent
const ACCENT_DEEP = "#006353"; // deep teal — Figma's CTA endpoint
const ACCENT_RGBA_TINT = "rgba(0,201,167,0.1)";
const ACCENT_RGBA_GLOW = "rgba(0,201,167,0.2)";

export type TierStanding = {
  id: string;
  name: string;
  /** Display order in the tier ladder (0-indexed) — drives icon mapping. */
  sortOrder: number;
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
            {/* Tier ladder — grid so each tier sits in an equal-width slot */}
            <div className="grid grid-cols-3 items-center">
              {visibleTiers.map((t) => (
                <div key={t.id} className="flex justify-center">
                  <TierCircle
                    name={t.name}
                    sortOrder={t.sortOrder}
                    variant={t.position}
                  />
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
                    background: "#C1E8FB",
                    boxShadow: `0 0 12px 0 ${ACCENT_RGBA_GLOW}`,
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
            className="mt-[72px] flex h-[56px] w-full items-center justify-center rounded-[28px] text-[16px] font-medium leading-[1.3] text-[#f9fdff] transition-opacity hover:opacity-90"
            style={{
              backgroundImage: `linear-gradient(90deg, ${ACCENT} 0%, ${ACCENT_DEEP} 100%)`,
              boxShadow: `0px 0px 18px 0px rgba(193,232,251,0.2), 0px 10px 24px 0px ${ACCENT_RGBA_GLOW}`,
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
  sortOrder,
  variant,
}: {
  name: string;
  sortOrder: number;
  variant: "past" | "current" | "future";
}) {
  const isCurrent = variant === "current";
  const circleSize = isCurrent ? "h-20 w-20" : "h-16 w-16";
  const iconSize = isCurrent ? "h-8 w-8" : "h-7 w-7";
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2",
        variant === "future" && "opacity-50",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-[40px] border-2",
          circleSize,
        )}
        style={
          isCurrent
            ? {
                borderColor: ACCENT,
                backgroundImage: `linear-gradient(90deg, ${ACCENT_RGBA_TINT} 0%, ${ACCENT_RGBA_TINT} 100%), linear-gradient(90deg, #1B1F20 0%, #1B1F20 100%)`,
                filter: `drop-shadow(0px 0px 9px ${ACCENT_RGBA_GLOW}) drop-shadow(0px 12px 12px ${ACCENT_RGBA_GLOW})`,
              }
            : {
                background: "#0e0e0e",
                borderColor: "#445158",
              }
        }
      >
        <TierIcon
          sortOrder={sortOrder}
          name={name}
          className={iconSize}
        />
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
