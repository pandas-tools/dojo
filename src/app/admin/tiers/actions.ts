"use server";

import { and, asc, eq, isNull, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { lessonTiers } from "@/lib/db/schema";
import { writeAuditEntry } from "@/lib/audit-log";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("forbidden");
  }
  return session;
}

// Admin v1 manages the GLOBAL ladder only (client_id IS NULL). The nullable
// column lets per-client ladders land later without a schema or admin change.
const GLOBAL = isNull(lessonTiers.clientId);

// Thrown inside a transaction when the resulting ladder would be invalid, so
// the mutation rolls back. Caught by each action and surfaced as { error }.
class LadderError extends Error {}

/**
 * Ladder invariants, validated over the global tiers that remain AFTER a
 * mutation (inside the same transaction):
 *   - the lowest threshold must be 0 (every employee needs a floor tier), and
 *   - no two tiers may share a threshold (each tier is a distinct rung).
 * An empty ladder is allowed — getTierConfig falls back to the hardcoded 3.
 */
function validateLadder(rows: { minPct: number }[]): string | null {
  if (rows.length === 0) return null;
  const pcts = rows.map((r) => r.minPct);
  if (Math.min(...pcts) !== 0) {
    return "The lowest tier must start at 0%.";
  }
  if (new Set(pcts).size !== pcts.length) {
    return "Two tiers can't share the same threshold.";
  }
  return null;
}

function normalizePct(input: unknown): number | null {
  if (typeof input !== "number" || !Number.isFinite(input)) return null;
  if (input < 0 || input > 1) return null;
  return input;
}

export async function createTier(input: {
  name: string;
  emoji: string;
  /** 0..1 fraction. */
  minPct: number;
}) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" as const };
  }
  const name = input.name.trim();
  const emoji = input.emoji.trim();
  if (!name) return { error: "Name is required" as const };
  if (!emoji) return { error: "Emoji is required" as const };
  const minPct = normalizePct(input.minPct);
  if (minPct === null) {
    return { error: "Threshold must be between 0% and 100%" as const };
  }

  let newId = "";
  try {
    await db.transaction(async (tx) => {
      const [{ value: currentMax }] = await tx
        .select({ value: max(lessonTiers.sortOrder) })
        .from(lessonTiers)
        .where(GLOBAL);
      const nextSort = currentMax === null ? 0 : currentMax + 10;

      const [row] = await tx
        .insert(lessonTiers)
        .values({ name, emoji, minPct, sortOrder: nextSort })
        .returning({ id: lessonTiers.id });
      newId = row.id;

      const remaining = await tx
        .select({ minPct: lessonTiers.minPct })
        .from(lessonTiers)
        .where(GLOBAL);
      const err = validateLadder(remaining);
      if (err) throw new LadderError(err);
    });
  } catch (e) {
    if (e instanceof LadderError) return { error: e.message };
    throw e;
  }

  await writeAuditEntry({
    action: "tier.create",
    targetType: "lesson_tier",
    targetId: newId,
    payload: { name, emoji, minPct },
  });
  revalidatePath("/admin/tiers");
  return { ok: true as const, tierId: newId };
}

export async function updateTier(input: {
  id: string;
  name?: string;
  emoji?: string;
  minPct?: number;
}) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" as const };
  }

  const patch: { name?: string; emoji?: string; minPct?: number } = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return { error: "Name cannot be empty" as const };
    patch.name = name;
  }
  if (input.emoji !== undefined) {
    const emoji = input.emoji.trim();
    if (!emoji) return { error: "Emoji cannot be empty" as const };
    patch.emoji = emoji;
  }
  if (input.minPct !== undefined) {
    const minPct = normalizePct(input.minPct);
    if (minPct === null) {
      return { error: "Threshold must be between 0% and 100%" as const };
    }
    patch.minPct = minPct;
  }
  if (Object.keys(patch).length === 0) {
    return { error: "Nothing to update" as const };
  }

  try {
    await db.transaction(async (tx) => {
      const updated = await tx
        .update(lessonTiers)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(lessonTiers.id, input.id), GLOBAL))
        .returning({ id: lessonTiers.id });
      if (updated.length === 0) throw new LadderError("Tier not found");

      const remaining = await tx
        .select({ minPct: lessonTiers.minPct })
        .from(lessonTiers)
        .where(GLOBAL);
      const err = validateLadder(remaining);
      if (err) throw new LadderError(err);
    });
  } catch (e) {
    if (e instanceof LadderError) return { error: e.message };
    throw e;
  }

  await writeAuditEntry({
    action: "tier.update",
    targetType: "lesson_tier",
    targetId: input.id,
    payload: patch,
  });
  revalidatePath("/admin/tiers");
  return { ok: true as const };
}

export async function deleteTier(input: { id: string }) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" as const };
  }

  let snapshot: { name: string; emoji: string; minPct: number } | null = null;
  try {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .select({
          name: lessonTiers.name,
          emoji: lessonTiers.emoji,
          minPct: lessonTiers.minPct,
        })
        .from(lessonTiers)
        .where(and(eq(lessonTiers.id, input.id), GLOBAL))
        .limit(1);
      if (!row) throw new LadderError("Tier not found");
      snapshot = row;

      await tx
        .delete(lessonTiers)
        .where(and(eq(lessonTiers.id, input.id), GLOBAL));

      const remaining = await tx
        .select({ minPct: lessonTiers.minPct })
        .from(lessonTiers)
        .where(GLOBAL);
      const err = validateLadder(remaining);
      if (err) {
        // Deleting this tier would leave the ladder without a 0% floor.
        throw new LadderError(
          "Can't delete this tier — the remaining tiers wouldn't start at 0%. Set another tier's threshold to 0% first.",
        );
      }
    });
  } catch (e) {
    if (e instanceof LadderError) return { error: e.message };
    throw e;
  }

  await writeAuditEntry({
    action: "tier.delete",
    targetType: "lesson_tier",
    targetId: input.id,
    payload: snapshot ?? undefined,
  });
  revalidatePath("/admin/tiers");
  return { ok: true as const };
}

// Neighbour-swap reorder over the global ladder, scoped to client_id IS NULL.
// Only sort_order (display order) changes — progression order is by minPct, so
// this never reclassifies anyone. Mirrors reorderLesson.
export async function reorderTier(input: {
  id: string;
  direction: "up" | "down";
}) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" as const };
  }

  const ordered = await db
    .select({ id: lessonTiers.id, sortOrder: lessonTiers.sortOrder })
    .from(lessonTiers)
    .where(GLOBAL)
    .orderBy(asc(lessonTiers.sortOrder));

  const idx = ordered.findIndex((t) => t.id === input.id);
  if (idx === -1) return { error: "Tier not found" as const };
  const neighbourIdx = input.direction === "up" ? idx - 1 : idx + 1;
  if (neighbourIdx < 0 || neighbourIdx >= ordered.length) {
    return { ok: true as const, noop: true };
  }
  const current = ordered[idx];
  const neighbour = ordered[neighbourIdx];

  await db.transaction(async (tx) => {
    await tx
      .update(lessonTiers)
      .set({ sortOrder: neighbour.sortOrder })
      .where(eq(lessonTiers.id, current.id));
    await tx
      .update(lessonTiers)
      .set({ sortOrder: current.sortOrder })
      .where(eq(lessonTiers.id, neighbour.id));
  });

  await writeAuditEntry({
    action: "tier.reorder",
    targetType: "lesson_tier",
    targetId: current.id,
    payload: { direction: input.direction, swappedWith: neighbour.id },
  });
  revalidatePath("/admin/tiers");
  return { ok: true as const };
}
