// Unit tests for the pure tier classifier. No database — classifyTier takes
// the ladder as an argument, so the data-driven N-tier behaviour is fully
// testable in isolation.

import { describe, expect, it } from "vitest";
import { classifyTier, FALLBACK_TIERS, type TierConfig } from "@/lib/tiers";

const THREE: TierConfig[] = [
  { id: "a", name: "Apprentice", emoji: "🌱", minPct: 0, sortOrder: 0 },
  { id: "s", name: "Specialist", emoji: "⚡", minPct: 0.34, sortOrder: 1 },
  { id: "e", name: "Expert", emoji: "🏆", minPct: 0.67, sortOrder: 2 },
];

describe("classifyTier — 3-tier ladder", () => {
  it("classifies the floor at 0 complete", () => {
    expect(classifyTier(0, 10, THREE).tierId).toBe("a");
  });

  it("stays apprentice just below the specialist threshold", () => {
    // 3/10 = 0.30 < 0.34
    expect(classifyTier(3, 10, THREE).tierId).toBe("a");
  });

  it("promotes to specialist at the threshold", () => {
    // 4/10 = 0.40 >= 0.34
    expect(classifyTier(4, 10, THREE).tierId).toBe("s");
  });

  it("promotes to expert at the top threshold", () => {
    // 7/10 = 0.70 >= 0.67
    expect(classifyTier(7, 10, THREE).tierId).toBe("e");
  });

  it("classifies a fully-complete user as expert", () => {
    const r = classifyTier(10, 10, THREE);
    expect(r.tierId).toBe("e");
    expect(r.nextTierId).toBeNull();
    expect(r.lessonsToNextTier).toBe(0);
  });

  it("reports lessons remaining to the next tier", () => {
    // at 3/10 (apprentice), specialist needs ceil(0.34*10)=4 → 1 to go
    const r = classifyTier(3, 10, THREE);
    expect(r.nextTierId).toBe("s");
    expect(r.lessonsToNextTier).toBe(1);
  });
});

describe("classifyTier — flexible tier count", () => {
  it("handles a 5-tier ladder", () => {
    const five: TierConfig[] = [
      { id: "t0", name: "T0", emoji: "0", minPct: 0, sortOrder: 0 },
      { id: "t1", name: "T1", emoji: "1", minPct: 0.25, sortOrder: 1 },
      { id: "t2", name: "T2", emoji: "2", minPct: 0.5, sortOrder: 2 },
      { id: "t3", name: "T3", emoji: "3", minPct: 0.75, sortOrder: 3 },
      { id: "t4", name: "T4", emoji: "4", minPct: 1, sortOrder: 4 },
    ];
    expect(classifyTier(0, 8, five).tierId).toBe("t0");
    expect(classifyTier(2, 8, five).tierId).toBe("t1"); // 0.25
    expect(classifyTier(4, 8, five).tierId).toBe("t2"); // 0.5
    expect(classifyTier(6, 8, five).tierId).toBe("t3"); // 0.75
    expect(classifyTier(8, 8, five).tierId).toBe("t4"); // 1.0
  });

  it("handles a single-tier ladder", () => {
    const one: TierConfig[] = [
      { id: "only", name: "Only", emoji: "x", minPct: 0, sortOrder: 0 },
    ];
    const r = classifyTier(5, 10, one);
    expect(r.tierId).toBe("only");
    expect(r.nextTierId).toBeNull();
  });
});

describe("classifyTier — ordering & edge cases", () => {
  it("orders by minPct, not sortOrder (display order is decoupled)", () => {
    // Same ladder, sortOrder reversed relative to minPct.
    const shuffled: TierConfig[] = [
      { id: "e", name: "Expert", emoji: "🏆", minPct: 0.67, sortOrder: 0 },
      { id: "a", name: "Apprentice", emoji: "🌱", minPct: 0, sortOrder: 1 },
      { id: "s", name: "Specialist", emoji: "⚡", minPct: 0.34, sortOrder: 2 },
    ];
    expect(classifyTier(0, 10, shuffled).tierId).toBe("a");
    expect(classifyTier(5, 10, shuffled).tierId).toBe("s");
    expect(classifyTier(9, 10, shuffled).tierId).toBe("e");
  });

  it("does not divide by zero when there are no lessons", () => {
    const r = classifyTier(0, 0, THREE);
    expect(r.tierId).toBe("a");
    expect(r.progressPct).toBe(0);
  });

  it("clamps completed above total", () => {
    const r = classifyTier(99, 10, THREE);
    expect(r.completed).toBe(10);
    expect(r.tierId).toBe("e");
  });

  it("falls back to the built-in ladder when given an empty ladder", () => {
    const r = classifyTier(0, 10, []);
    expect(r.tierId).toBe(FALLBACK_TIERS[0].id);
  });

  it("defaults to the fallback ladder when omitted", () => {
    const r = classifyTier(10, 10);
    expect(r.tierId).toBe(FALLBACK_TIERS[FALLBACK_TIERS.length - 1].id);
  });
});
