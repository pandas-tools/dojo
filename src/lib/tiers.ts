// Pure tier logic — the data-driven replacement for the hardcoded
// Apprentice/Specialist/Expert constants in `@/lib/tier`. No DB import, so it's
// safe to use from client components and unit-testable in isolation. The live
// DB readers (getTierConfig / getClientTierRollup / getBrowseTierData) live in
// `@/lib/tiers-data`.
//
// Ladder semantics: a tier is "reached" when the employee's completed fraction
// of their client's assigned, published lessons crosses `minPct` (0..1).
// Classification orders by minPct (the threshold is the source of truth for
// progression); `sortOrder` is only the admin/display order, so the two stay
// decoupled — reordering the admin list never changes who is in which tier.

export type TierConfig = {
  id: string;
  name: string;
  emoji: string;
  /** Threshold as a 0..1 fraction of assigned lessons completed. */
  minPct: number;
  /** Admin/display order. NOT the progression order — that's minPct. */
  sortOrder: number;
};

// Defensive fallback — mirrors the original code-defined ladder so an empty or
// unreachable table can never blank the /browse hero. Stable ids so consumers
// (and the counts map) stay keyable even when running in fallback mode.
export const FALLBACK_TIERS: readonly TierConfig[] = [
  { id: "fallback-apprentice", name: "Apprentice", emoji: "🌱", minPct: 0, sortOrder: 0 },
  { id: "fallback-specialist", name: "Specialist", emoji: "⚡", minPct: 0.34, sortOrder: 1 },
  { id: "fallback-expert", name: "Expert", emoji: "🏆", minPct: 0.67, sortOrder: 2 },
];

export type TierStanding = {
  tierId: string;
  nextTierId: string | null;
  completed: number;
  total: number;
  progressPct: number;
  lessonsToNextTier: number;
};

/**
 * Pure classification: which tier `completed / total` lands in, against the
 * given ladder. Orders the ladder by minPct (progression order), so display
 * order is irrelevant here. Defaults to FALLBACK_TIERS so old 2-arg callers
 * and degenerate empty ladders still resolve to a sane tier.
 */
export function classifyTier(
  completed: number,
  total: number,
  tiers: readonly TierConfig[] = FALLBACK_TIERS,
): TierStanding {
  const ladder = (tiers.length ? [...tiers] : [...FALLBACK_TIERS]).sort(
    (a, b) => a.minPct - b.minPct || a.sortOrder - b.sortOrder,
  );

  const safeTotal = Math.max(total, 0);
  const safeCompleted = Math.min(Math.max(completed, 0), safeTotal);
  const progressPct = safeTotal === 0 ? 0 : safeCompleted / safeTotal;

  // Current tier = highest minPct that progress has reached. The ladder always
  // has a floor (minPct 0) in practice; index 0 is the safety net if not.
  let currentIdx = 0;
  for (let i = 0; i < ladder.length; i++) {
    if (progressPct >= ladder[i].minPct) currentIdx = i;
  }
  const current = ladder[currentIdx];
  const next = ladder[currentIdx + 1] ?? null;

  const lessonsToNextTier = next
    ? Math.max(0, Math.ceil(next.minPct * safeTotal) - safeCompleted)
    : 0;

  return {
    tierId: current.id,
    nextTierId: next?.id ?? null,
    completed: safeCompleted,
    total: safeTotal,
    progressPct,
    lessonsToNextTier,
  };
}

/** Per-tier colleague headcount, keyed by tier id. Every tier id present. */
export type TierDistribution = Record<string, number>;

export type BrowseTierData = {
  /** Active ladder in display order. */
  tiers: TierConfig[];
  /** The current user's standing. `total` is the client-wide denominator. */
  me: { completed: number; total: number; tierId: string };
  /** CLIENT-WIDE colleague headcount per tier id (includes the user). */
  counts: TierDistribution;
};
