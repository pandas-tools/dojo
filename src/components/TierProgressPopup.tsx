"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import AnimatedEmoji from "./AnimatedEmoji";

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
  /** Display order in the tier ladder (0-indexed). */
  sortOrder: number;
  /** Emoji glyph from tier config — resolved to Noto Lottie in <AnimatedEmoji>. */
  emoji: string;
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
  ctaHref,
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
  /** When set, the CTA closes the dialog and pushes this route. */
  ctaHref?: string;
  trigger?: ReactNode;
}) {
  const router = useRouter();
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
          className="fixed left-1/2 top-1/2 z-50 w-[338px] -translate-x-1/2 -translate-y-1/2 rounded-[40px] border border-[rgba(193,232,251,0.56)] px-6 pb-10 pt-10 shadow-[0px_-16px_40px_0px_rgba(193,232,251,0.2),0px_-24px_60px_0px_rgba(0,0,0,0.5)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0"
          style={{
            backgroundImage:
              "linear-gradient(90deg, #0e0e0e 0%, rgba(68,81,88,0.2) 100%), linear-gradient(90deg, #0e0e0e 0%, #0e0e0e 100%)",
          }}
          aria-describedby={undefined}
        >
          <div className="flex flex-col gap-8">
            {/* Symmetric px-10 so the centered title reads centered against
                the dialog, and stays clear of the close X in the top-right. */}
            <Dialog.Title className="px-10 text-center text-[20px] font-medium leading-tight tracking-tight text-[#f9fdff]">
              Keep track of your progress
            </Dialog.Title>

            {/* Tier ladder — grid so each tier sits in an equal-width slot.
                Icons stagger in left→right when the dialog mounts. */}
            <div className="grid grid-cols-3 items-center">
              {visibleTiers.map((t, i) => (
                <div key={t.id} className="flex justify-center">
                  <TierCircle
                    name={t.name}
                    emoji={t.emoji}
                    variant={t.position}
                    index={i}
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
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-[10px]"
                  initial={{ width: "0%" }}
                  animate={{ width: `${pct}%` }}
                  transition={{
                    delay: 0.55,
                    duration: 0.9,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  style={{
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
            onClick={() => {
              onOpenChange?.(false);
              if (ctaHref) router.push(ctaHref);
            }}
            className="tier-cta-shimmer mt-[72px] flex h-[56px] w-full items-center justify-center rounded-[28px] text-[16px] font-medium leading-[1.3] text-[#f9fdff] transition-opacity hover:opacity-90"
            style={{
              backgroundImage: `linear-gradient(90deg, ${ACCENT} 0%, ${ACCENT_DEEP} 50%, ${ACCENT} 100%)`,
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
  emoji,
  variant,
  index,
}: {
  name: string;
  emoji: string;
  variant: "past" | "current" | "future";
  index: number;
}) {
  const isCurrent = variant === "current";
  const circleSize = isCurrent ? "h-20 w-20" : "h-16 w-16";
  const iconSize = isCurrent ? "h-8 w-8" : "h-7 w-7";
  // Entry stagger: 180ms buffer after the dialog's own zoom-in, then 110ms
  // between tiles. Current tile gets a spring overshoot + a single pulse
  // beat so the eye lands on it after the row settles.
  const entryDelay = 0.18 + index * 0.11;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: entryDelay, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "flex flex-col items-center gap-2",
        variant === "future" && "opacity-50",
      )}
    >
      <motion.div
        initial={{ scale: 0.6 }}
        animate={
          isCurrent
            ? { scale: [0.6, 1.08, 0.98, 1.04, 1] }
            : { scale: 1 }
        }
        transition={
          isCurrent
            ? {
                delay: entryDelay,
                duration: 0.75,
                times: [0, 0.35, 0.6, 0.82, 1],
                ease: [0.16, 1, 0.3, 1],
              }
            : {
                delay: entryDelay,
                duration: 0.4,
                ease: [0.16, 1, 0.3, 1],
              }
        }
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
        <AnimatedEmoji
          emoji={emoji}
          play
          className={iconSize}
        />
      </motion.div>
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
    </motion.div>
  );
}
