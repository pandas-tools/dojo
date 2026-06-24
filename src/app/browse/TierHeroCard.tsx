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
        className={cn(
          "group block w-full text-left",
          "rounded-2xl bg-zinc-900/80 ring-1 ring-white/5",
          "px-4 py-3 sm:px-5 sm:py-3.5",
          "transition-colors hover:bg-zinc-900",
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 flex-1 text-sm text-white/90">
            You are <span className="text-base">{currentTier.emoji}</span>{" "}
            <span className="font-semibold text-white">{currentTier.name}</span>
            {nextTier ? (
              <span className="text-white/55">
                {" · "}
                {standing.lessonsToNextTier}{" "}
                {standing.lessonsToNextTier === 1 ? "lesson" : "lessons"} to{" "}
                {nextTier.name}
              </span>
            ) : null}
          </p>
          <ChevronRight className="h-4 w-4 shrink-0 text-white/35 transition-transform group-hover:translate-x-0.5" />
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

// Color treatment is POSITIONAL — first tier = warm/amber, top tier = emerald
// (Pandas brand), everything in between = sky. Works for N=3 today and any
// N≥2 if admin adds tiers later.
function tierStyle(index: number, total: number): {
  ring: string;
  bg: string;
  accent: string;
  text: string;
} {
  if (total <= 1 || index === total - 1) {
    return {
      ring: "ring-emerald-400/30",
      bg: "bg-emerald-950/30",
      accent: "text-emerald-200",
      text: "text-emerald-50",
    };
  }
  if (index === 0) {
    return {
      ring: "ring-amber-400/30",
      bg: "bg-amber-950/30",
      accent: "text-amber-200",
      text: "text-amber-50",
    };
  }
  return {
    ring: "ring-sky-400/30",
    bg: "bg-sky-950/30",
    accent: "text-sky-200",
    text: "text-sky-50",
  };
}

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
        className="border-white/10 bg-zinc-950 text-white shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-center justify-between">
          <DialogTitle className="text-lg font-semibold text-white">
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

        <div className="mt-1 flex flex-col gap-2.5">
          {stackOrder.map((tier) => {
            const ladderIndex = ladder.findIndex((t) => t.id === tier.id);
            const isYou = tier.id === currentTierId;
            const isAboveYou = ladderIndex > currentIndex;
            const isBelowYou = ladderIndex < currentIndex;
            const styles = tierStyle(ladderIndex, ladder.length);
            const count = counts[tier.id] ?? 0;

            return (
              <div
                key={tier.id}
                className={cn(
                  "relative rounded-2xl px-4 py-4 ring-1",
                  styles.bg,
                  isYou ? `ring-2 ${styles.ring}` : "ring-white/5",
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/30 text-xl">
                    {tier.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-base font-semibold", styles.text)}>
                        {tier.name}
                      </span>
                      {isYou && (
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/90">
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
                    <div className={cn("text-right text-sm leading-tight", styles.accent)}>
                      <div className="font-semibold">{count} ahead</div>
                      <div className="text-[10px] uppercase tracking-wider text-white/45">
                        of you
                      </div>
                    </div>
                  )}

                  {isBelowYou && (
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-400/20">
                      <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                      <span>Completed</span>
                    </div>
                  )}

                  {isYou && (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-black">
                      {userInitial}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {groupProgress.length > 0 && (
          <div className="mt-5 border-t border-white/5 pt-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-white/45">
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
                    <div className="text-xs tabular-nums text-white/55">
                      {g.completed}/{g.total}
                    </div>
                    <div className="h-1 w-16 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full bg-emerald-400/80"
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
