"use client";

import { useState, useMemo } from "react";
import { Check, ChevronRight, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  classifyTier,
  type BrowseTierData,
  type TierConfig,
} from "@/lib/tiers";
import { cn } from "@/lib/cn";

type GroupProgress = { name: string; completed: number; total: number };

type Props = {
  tierData: BrowseTierData;
  userInitial: string;
  groupProgress: GroupProgress[];
};

export default function TierHeroCard({
  tierData,
  userInitial,
  groupProgress,
}: Props) {
  const [open, setOpen] = useState(false);

  // Progression order (low → high) drives "above/below me" math; admin display
  // order would let a re-sort silently move people between tiers.
  const ladder = useMemo(
    () => [...tierData.tiers].sort((a, b) => a.minPct - b.minPct),
    [tierData.tiers],
  );

  const standing = useMemo(
    () =>
      classifyTier(
        tierData.me.completed,
        tierData.me.total,
        tierData.tiers,
      ),
    [tierData.tiers, tierData.me.completed, tierData.me.total],
  );

  const currentTier = ladder.find((t) => t.id === standing.tierId) ?? ladder[0];
  const nextTier = standing.nextTierId
    ? ladder.find((t) => t.id === standing.nextTierId) ?? null
    : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        // Layered bg: arctic-haze radial bleed from the left edge over a
        // quiet white wash. Inline-style instead of an absolute child span
        // so the button structure stays flat — earlier attempt with an
        // absolute glow + overflow-hidden killed taps on iOS.
        style={{
          backgroundImage:
            "radial-gradient(70% 140% at 0% 50%, rgba(193,232,251,0.14), transparent 55%), linear-gradient(rgba(255,255,255,0.04), rgba(255,255,255,0.04))",
        }}
        className={cn(
          "group block w-full text-left",
          "rounded-2xl ring-1 ring-white/8",
          "px-4 py-3 sm:px-5 sm:py-3.5",
          "transition-shadow duration-200 hover:ring-arctic-haze/25",
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 flex-1 text-sm text-white/90">
            You are <span className="text-base">{currentTier.emoji}</span>{" "}
            <span className="font-medium text-white">{currentTier.name}</span>
            {nextTier ? (
              <span className="text-white/55">
                {" · "}
                {standing.lessonsToNextTier}{" "}
                {standing.lessonsToNextTier === 1 ? "lesson" : "lessons"} to{" "}
                {nextTier.name}
              </span>
            ) : null}
          </p>
          <ChevronRight className="h-4 w-4 shrink-0 text-white/35 transition-transform group-hover:translate-x-0.5 group-hover:text-arctic-haze" />
        </div>
      </button>

      <TierModal
        open={open}
        onOpenChange={setOpen}
        ladder={ladder}
        currentTierId={standing.tierId}
        nextTierName={nextTier?.name ?? null}
        lessonsToNextTier={standing.lessonsToNextTier}
        completed={standing.completed}
        total={standing.total}
        counts={tierData.counts}
        userInitial={userInitial}
        groupProgress={groupProgress}
      />
    </>
  );
}

// The Pandas palette is intentionally cool — no warm hues exist as brand
// elements. So rather than rotating hue per tier (amber/sky/emerald), we
// treat tier hierarchy with restraint: every row is a quiet dark card, the
// user's own tier is the one wearing the arctic-haze brand wash + ring.
const TIER_ROW_BASE = "bg-white/[0.035] ring-white/5";
const TIER_ROW_ACCENT = "text-white/55";
const TIER_ROW_TEXT = "text-white";

const YOUR_TIER_ROW = "bg-arctic-haze/[0.07] ring-arctic-haze/35";
const YOUR_TIER_ACCENT = "text-arctic-haze";
const YOUR_TIER_TEXT = "text-white";

function TierModal({
  open,
  onOpenChange,
  ladder,
  currentTierId,
  nextTierName,
  lessonsToNextTier,
  completed,
  total,
  counts,
  userInitial,
  groupProgress,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ladder: TierConfig[];
  currentTierId: string;
  nextTierName: string | null;
  lessonsToNextTier: number;
  completed: number;
  total: number;
  counts: Record<string, number>;
  userInitial: string;
  groupProgress: GroupProgress[];
}) {
  const currentIndex = ladder.findIndex((t) => t.id === currentTierId);
  const stackOrder = [...ladder].reverse();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="sm"
        hideClose
        className="relative overflow-hidden border-white/10 bg-near-black text-white shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)]"
      >
        {/* Internal arctic-haze glow at the top of the modal */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(80%_100%_at_50%_0%,rgba(193,232,251,0.18),transparent_70%)]"
        />
        <div className="relative flex items-center justify-between">
          <DialogTitle className="text-lg font-medium text-white">
            Your training
          </DialogTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="rounded-md p-1.5 text-white/50 hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative mt-1 flex flex-col gap-2.5">
          {stackOrder.map((tier) => {
            const ladderIndex = ladder.findIndex((t) => t.id === tier.id);
            const isYou = tier.id === currentTierId;
            const isAboveYou = ladderIndex > currentIndex;
            const isBelowYou = ladderIndex < currentIndex;
            const count = counts[tier.id] ?? 0;

            return (
              <div
                key={tier.id}
                className={cn(
                  "relative rounded-2xl px-4 py-4 ring-1",
                  isYou
                    ? cn(YOUR_TIER_ROW, "ring-2")
                    : TIER_ROW_BASE,
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/30 text-xl">
                    {tier.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-base font-medium",
                          isYou ? YOUR_TIER_TEXT : TIER_ROW_TEXT,
                        )}
                      >
                        {tier.name}
                      </span>
                      {isYou && (
                        <span className="rounded-full bg-arctic-haze/20 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-arctic-haze">
                          You
                        </span>
                      )}
                    </div>
                    {isYou && nextTierName && (
                      <p className="mt-0.5 text-xs text-white/60">
                        {lessonsToNextTier}{" "}
                        {lessonsToNextTier === 1 ? "lesson" : "lessons"} to{" "}
                        {nextTierName}
                      </p>
                    )}
                    {isYou && !nextTierName && (
                      <p className="mt-0.5 text-xs text-white/60">
                        Top tier reached — {completed} of {total} complete
                      </p>
                    )}
                  </div>

                  {isAboveYou && count > 0 && (
                    <div
                      className={cn(
                        "text-right text-sm leading-tight",
                        TIER_ROW_ACCENT,
                      )}
                    >
                      <div className="font-medium text-white/80">{count} ahead</div>
                      <div className="font-mono text-[10px] uppercase tracking-wider text-white/45">
                        of you
                      </div>
                    </div>
                  )}

                  {isBelowYou && (
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success ring-1 ring-success/25">
                      <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                      <span>Completed</span>
                    </div>
                  )}

                  {isYou && (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-arctic-haze text-sm font-medium text-near-black">
                      {userInitial}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {groupProgress.length > 0 && (
          <div className="relative mt-5 border-t border-white/5 pt-5">
            <div className="font-mono text-xs font-medium uppercase tracking-wider text-white/45">
              Progress by group
            </div>
            <div className="mt-3 flex flex-col gap-2.5">
              {groupProgress.map((g) => {
                const pct = g.total === 0 ? 0 : g.completed / g.total;
                return (
                  <div key={g.name} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1 truncate text-sm text-white/85">
                      {g.name}
                    </div>
                    <div className="font-mono text-xs tabular-nums text-white/55">
                      {g.completed}/{g.total}
                    </div>
                    <div className="h-1 w-16 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full bg-arctic-haze/80"
                        style={{ width: `${Math.round(pct * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
