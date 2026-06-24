// Live tier readers — the server-side data layer for the tier system. Imports
// the DB client, so this is server-only; keep it out of client components. Pure
// types + the classifier live in `@/lib/tiers`.
//
// Counts are CLIENT-WIDE only (decided 2026-06-24): an employee competes
// against everyone in their entire organisation, not just their store.

import { cache } from "react";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  lessonTiers,
  clientLessons,
  lessons,
  lessonEvents,
  users,
} from "@/lib/db/schema";
import {
  classifyTier,
  FALLBACK_TIERS,
  type TierConfig,
  type TierDistribution,
  type BrowseTierData,
} from "@/lib/tiers";

/**
 * The active tier ladder for a client, ordered by sortOrder (display order).
 *
 * Resolution: client-specific rows if any exist for `clientId` (a future
 * per-client override — not written by admin v1), otherwise the global ladder
 * (client_id IS NULL). Empty/unreachable → FALLBACK_TIERS so the UI never
 * blanks. Request-memoized via React `cache` — one query per render at most.
 */
export const getTierConfig = cache(
  async (clientId?: string | null): Promise<TierConfig[]> => {
    try {
      let rows = clientId
        ? await db
            .select()
            .from(lessonTiers)
            .where(
              and(
                eq(lessonTiers.clientId, clientId),
                eq(lessonTiers.isActive, true),
              ),
            )
            .orderBy(asc(lessonTiers.sortOrder))
        : [];

      if (rows.length === 0) {
        rows = await db
          .select()
          .from(lessonTiers)
          .where(
            and(isNull(lessonTiers.clientId), eq(lessonTiers.isActive, true)),
          )
          .orderBy(asc(lessonTiers.sortOrder));
      }

      if (rows.length === 0) return [...FALLBACK_TIERS];

      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        emoji: r.emoji,
        minPct: r.minPct,
        sortOrder: r.sortOrder,
      }));
    } catch (err) {
      console.warn(
        "getTierConfig: DB read failed, using fallback ladder:",
        err instanceof Error ? err.message : String(err),
      );
      return [...FALLBACK_TIERS];
    }
  },
);

/**
 * Client-wide tier distribution: classify every employee in the client against
 * the same denominator (the client's assigned, published lesson count) and
 * tally per tier. Mirrors the in-memory aggregation in `@/lib/analytics`.
 *
 * `total` is uniform for everyone in a client because assignment is per-client
 * (client_lessons), so it doubles as the denominator for the current user too.
 */
export async function getClientTierRollup(
  clientId: string,
  tiers: readonly TierConfig[],
): Promise<{ total: number; counts: TierDistribution }> {
  const counts: TierDistribution = {};
  for (const t of tiers) counts[t.id] = 0;

  // Assigned + published lessons for this client = the denominator.
  const assignedRows = await db
    .select({ lessonId: clientLessons.lessonId })
    .from(clientLessons)
    .innerJoin(lessons, eq(lessons.id, clientLessons.lessonId))
    .where(
      and(eq(clientLessons.clientId, clientId), eq(lessons.isPublished, true)),
    );
  const assignedIds = assignedRows.map((r) => r.lessonId);
  const total = assignedIds.length;

  const employees = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.clientId, clientId), eq(users.role, "employee")));

  if (employees.length === 0) return { total, counts };

  // Completed-lesson events for these employees, restricted to assigned
  // lessons. De-duped per (user, lesson) via the Set.
  const completedByUser = new Map<string, Set<string>>();
  if (assignedIds.length > 0) {
    const empIds = employees.map((e) => e.id);
    const events = await db
      .select({
        userId: lessonEvents.userId,
        lessonId: lessonEvents.lessonId,
      })
      .from(lessonEvents)
      .where(
        and(
          eq(lessonEvents.eventType, "lesson_completed"),
          inArray(lessonEvents.userId, empIds),
          inArray(lessonEvents.lessonId, assignedIds),
        ),
      );
    for (const ev of events) {
      const set = completedByUser.get(ev.userId) ?? new Set<string>();
      set.add(ev.lessonId);
      completedByUser.set(ev.userId, set);
    }
  }

  for (const e of employees) {
    const done = completedByUser.get(e.id)?.size ?? 0;
    const { tierId } = classifyTier(done, total, tiers);
    counts[tierId] = (counts[tierId] ?? 0) + 1;
  }

  return { total, counts };
}

/**
 * The single read the /browse hero consumes. Resolves the ladder, computes the
 * client-wide distribution, and classifies the current user against the same
 * denominator everyone else is measured by (rollup.total) so the user is never
 * classified on a different basis than their colleagues.
 *
 * `completed` is the user's own completed count over their assigned, published
 * lessons — pass `data.totals.completed` from getBrowseData().
 */
export async function getBrowseTierData(input: {
  clientId: string;
  completed: number;
}): Promise<BrowseTierData> {
  const tiers = await getTierConfig(input.clientId);
  const rollup = await getClientTierRollup(input.clientId, tiers);
  const standing = classifyTier(input.completed, rollup.total, tiers);

  return {
    tiers,
    me: {
      completed: standing.completed,
      total: rollup.total,
      tierId: standing.tierId,
    },
    counts: rollup.counts,
  };
}
