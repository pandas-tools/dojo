export type Tier = "apprentice" | "specialist" | "expert";

export const TIER_ORDER: readonly Tier[] = ["apprentice", "specialist", "expert"] as const;

export const TIER_META: Record<
  Tier,
  { name: string; emoji: string; minPct: number }
> = {
  apprentice: { name: "Apprentice", emoji: "🌱", minPct: 0 },
  specialist: { name: "Specialist", emoji: "⚡", minPct: 0.34 },
  expert: { name: "Expert", emoji: "🏆", minPct: 0.67 },
};

export type TierState = {
  tier: Tier;
  nextTier: Tier | null;
  completed: number;
  total: number;
  progressPct: number;
  lessonsToNextTier: number;
};

export function classifyTier(completed: number, total: number): TierState {
  const safeTotal = Math.max(total, 0);
  const safeCompleted = Math.min(Math.max(completed, 0), safeTotal);
  const progressPct = safeTotal === 0 ? 0 : safeCompleted / safeTotal;

  const tier: Tier =
    progressPct >= TIER_META.expert.minPct
      ? "expert"
      : progressPct >= TIER_META.specialist.minPct
        ? "specialist"
        : "apprentice";

  const nextTier: Tier | null =
    tier === "apprentice" ? "specialist" : tier === "specialist" ? "expert" : null;

  const lessonsToNextTier = nextTier
    ? Math.max(
        0,
        Math.ceil(TIER_META[nextTier].minPct * safeTotal) - safeCompleted,
      )
    : 0;

  return {
    tier,
    nextTier,
    completed: safeCompleted,
    total: safeTotal,
    progressPct,
    lessonsToNextTier,
  };
}
