"use server";

import { eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { lessons, lessonGroups } from "@/lib/db/schema";
import { writeAuditEntry } from "@/lib/audit-log";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("forbidden");
  }
  return session;
}

const NAME_MAX = 80;

function cleanName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, NAME_MAX);
}

function revalidateGroups(groupId?: string) {
  revalidatePath("/admin/lesson-groups");
  if (groupId) revalidatePath(`/admin/lesson-groups/${groupId}`);
  // /browse renders the group rails from this data.
  revalidatePath("/browse");
}

// ── Group CRUD ─────────────────────────────────────────────────────────────

export async function createGroup(input: { name: string }) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" as const };
  }
  const name = cleanName(input.name ?? "");
  if (!name) return { error: "Name is required" as const };

  const [{ value: maxOrder } = { value: null }] = await db
    .select({ value: max(lessonGroups.sortOrder) })
    .from(lessonGroups);
  const sortOrder = (maxOrder ?? -1) + 1;

  const [row] = await db
    .insert(lessonGroups)
    .values({ name, sortOrder })
    .returning({ id: lessonGroups.id });

  await writeAuditEntry({
    action: "lesson_group.create",
    targetType: "lesson_group",
    targetId: row.id,
    payload: { name, sortOrder },
  });
  revalidateGroups(row.id);
  return { ok: true as const, groupId: row.id };
}

export async function renameGroup(input: { groupId: string; name: string }) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" as const };
  }
  const name = cleanName(input.name ?? "");
  if (!name) return { error: "Name is required" as const };

  const [updated] = await db
    .update(lessonGroups)
    .set({ name, updatedAt: new Date() })
    .where(eq(lessonGroups.id, input.groupId))
    .returning({ id: lessonGroups.id });
  if (!updated) return { error: "Group not found" as const };

  await writeAuditEntry({
    action: "lesson_group.update",
    targetType: "lesson_group",
    targetId: input.groupId,
    payload: { name },
  });
  revalidateGroups(input.groupId);
  return { ok: true as const };
}

export async function deleteGroup(input: { groupId: string }) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" as const };
  }
  const [snapshot] = await db
    .select({ name: lessonGroups.name })
    .from(lessonGroups)
    .where(eq(lessonGroups.id, input.groupId))
    .limit(1);

  // FK on lessons.group_id is ON DELETE SET NULL, so member lessons are
  // orphaned (return to "ungrouped") rather than deleted.
  await db.delete(lessonGroups).where(eq(lessonGroups.id, input.groupId));

  await writeAuditEntry({
    action: "lesson_group.delete",
    targetType: "lesson_group",
    targetId: input.groupId,
    payload: snapshot ?? null,
  });
  revalidateGroups();
  return { ok: true as const };
}

export async function reorderGroup(input: {
  groupId: string;
  direction: "up" | "down";
}) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" as const };
  }
  const ordered = await db
    .select({ id: lessonGroups.id, sortOrder: lessonGroups.sortOrder })
    .from(lessonGroups)
    .orderBy(lessonGroups.sortOrder, lessonGroups.createdAt);
  const idx = ordered.findIndex((g) => g.id === input.groupId);
  if (idx === -1) return { error: "Group not found" as const };
  const neighbourIdx = input.direction === "up" ? idx - 1 : idx + 1;
  if (neighbourIdx < 0 || neighbourIdx >= ordered.length) {
    return { ok: true as const, noop: true };
  }
  const current = ordered[idx];
  const neighbour = ordered[neighbourIdx];

  // Swap sortOrder in a transaction (sortOrder isn't unique, so this is
  // collision-safe and never leaves the list half-applied).
  await db.transaction(async (tx) => {
    await tx
      .update(lessonGroups)
      .set({ sortOrder: neighbour.sortOrder })
      .where(eq(lessonGroups.id, current.id));
    await tx
      .update(lessonGroups)
      .set({ sortOrder: current.sortOrder })
      .where(eq(lessonGroups.id, neighbour.id));
  });

  await writeAuditEntry({
    action: "lesson_group.reorder",
    targetType: "lesson_group",
    targetId: current.id,
    payload: { direction: input.direction, swappedWith: neighbour.id },
  });
  revalidateGroups();
  return { ok: true as const };
}

// ── Lesson ↔ group assignment ───────────────────────────────────────────────

export async function assignLessonToGroup(input: {
  lessonId: string;
  groupId: string;
}) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" as const };
  }
  const [group] = await db
    .select({ id: lessonGroups.id })
    .from(lessonGroups)
    .where(eq(lessonGroups.id, input.groupId))
    .limit(1);
  if (!group) return { error: "Group not found" as const };

  // Append to the end of the target group's order. Uses the dedicated
  // groupSortOrder column so the global /admin/lessons order is untouched.
  const [{ value: maxOrder } = { value: null }] = await db
    .select({ value: max(lessons.groupSortOrder) })
    .from(lessons)
    .where(eq(lessons.groupId, input.groupId));
  const groupSortOrder = (maxOrder ?? -1) + 1;

  const [updated] = await db
    .update(lessons)
    .set({ groupId: input.groupId, groupSortOrder })
    .where(eq(lessons.id, input.lessonId))
    .returning({ id: lessons.id });
  if (!updated) return { error: "Lesson not found" as const };

  await writeAuditEntry({
    action: "lesson_group.assign_lesson",
    targetType: "lesson",
    targetId: input.lessonId,
    payload: { groupId: input.groupId, groupSortOrder },
  });
  revalidateGroups(input.groupId);
  revalidatePath("/admin/lessons");
  return { ok: true as const };
}

export async function removeLessonFromGroup(input: { lessonId: string }) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" as const };
  }
  const [current] = await db
    .select({ groupId: lessons.groupId })
    .from(lessons)
    .where(eq(lessons.id, input.lessonId))
    .limit(1);
  if (!current) return { error: "Lesson not found" as const };

  await db
    .update(lessons)
    .set({ groupId: null })
    .where(eq(lessons.id, input.lessonId));

  await writeAuditEntry({
    action: "lesson_group.remove_lesson",
    targetType: "lesson",
    targetId: input.lessonId,
    payload: { groupId: current.groupId },
  });
  revalidateGroups(current.groupId ?? undefined);
  revalidatePath("/admin/lessons");
  return { ok: true as const };
}

export async function reorderLessonInGroup(input: {
  lessonId: string;
  direction: "up" | "down";
}) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" as const };
  }
  const [current] = await db
    .select({
      id: lessons.id,
      groupSortOrder: lessons.groupSortOrder,
      groupId: lessons.groupId,
    })
    .from(lessons)
    .where(eq(lessons.id, input.lessonId))
    .limit(1);
  if (!current) return { error: "Lesson not found" as const };
  if (!current.groupId) return { error: "Lesson is not in a group" as const };

  const ordered = await db
    .select({ id: lessons.id, groupSortOrder: lessons.groupSortOrder })
    .from(lessons)
    .where(eq(lessons.groupId, current.groupId))
    .orderBy(lessons.groupSortOrder, lessons.createdAt);
  const idx = ordered.findIndex((l) => l.id === current.id);
  const neighbourIdx = input.direction === "up" ? idx - 1 : idx + 1;
  if (neighbourIdx < 0 || neighbourIdx >= ordered.length) {
    return { ok: true as const, noop: true };
  }
  const neighbour = ordered[neighbourIdx];

  await db.transaction(async (tx) => {
    await tx
      .update(lessons)
      .set({ groupSortOrder: neighbour.groupSortOrder })
      .where(eq(lessons.id, current.id));
    await tx
      .update(lessons)
      .set({ groupSortOrder: current.groupSortOrder })
      .where(eq(lessons.id, neighbour.id));
  });

  await writeAuditEntry({
    action: "lesson_group.reorder_lesson",
    targetType: "lesson",
    targetId: current.id,
    payload: {
      groupId: current.groupId,
      direction: input.direction,
      swappedWith: neighbour.id,
    },
  });
  revalidateGroups(current.groupId);
  return { ok: true as const };
}
