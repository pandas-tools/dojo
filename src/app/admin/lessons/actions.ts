"use server";

import { and, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  lessons,
  lessonTranslations,
  clientLessons,
} from "@/lib/db/schema";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("forbidden");
  }
  return session;
}

export async function createLesson(input: {
  internalName: string;
  title: string;
  description?: string;
}) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" };
  }
  if (!input.internalName.trim() || !input.title.trim()) {
    return { error: "internalName and title are required" };
  }

  // Find next sort_order
  const [{ value: currentMax }] = await db
    .select({ value: max(lessons.sortOrder) })
    .from(lessons);
  const nextSort = (currentMax ?? 0) + 10;

  const [lesson] = await db
    .insert(lessons)
    .values({
      internalName: input.internalName.trim(),
      type: "training",
      sortOrder: nextSort,
      isPublished: false,
    })
    .returning();

  await db.insert(lessonTranslations).values({
    lessonId: lesson.id,
    language: "en",
    title: input.title.trim(),
    description: input.description?.trim() || null,
  });

  revalidatePath("/admin/lessons");
  return { ok: true, lessonId: lesson.id };
}

type LessonType = "training" | "announcement" | "update";

export async function updateLesson(input: {
  lessonId: string;
  internalName?: string;
  type?: LessonType;
  sortOrder?: number;
}) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" };
  }
  const patch: {
    internalName?: string;
    type?: LessonType;
    sortOrder?: number;
  } = {};
  if (input.internalName !== undefined) {
    const trimmed = input.internalName.trim();
    if (!trimmed) return { error: "internalName cannot be empty" };
    patch.internalName = trimmed;
  }
  if (input.type !== undefined) {
    if (!["training", "announcement", "update"].includes(input.type)) {
      return { error: "invalid type" };
    }
    patch.type = input.type;
  }
  if (input.sortOrder !== undefined) {
    if (!Number.isFinite(input.sortOrder)) {
      return { error: "invalid sortOrder" };
    }
    patch.sortOrder = input.sortOrder;
  }
  if (Object.keys(patch).length === 0) {
    return { error: "no fields to update" };
  }
  await db.update(lessons).set(patch).where(eq(lessons.id, input.lessonId));
  revalidatePath("/admin/lessons");
  revalidatePath(`/admin/lessons/${input.lessonId}`);
  return { ok: true };
}

// Reorder a lesson by swapping its sortOrder with the immediate neighbour
// in the requested direction. Single-step swap keeps the data model simple
// and the UX predictable; the admin clicks up/down arrows on the list page.
export async function reorderLesson(input: {
  lessonId: string;
  direction: "up" | "down";
}) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" };
  }
  const [current] = await db
    .select({ id: lessons.id, sortOrder: lessons.sortOrder })
    .from(lessons)
    .where(eq(lessons.id, input.lessonId))
    .limit(1);
  if (!current) return { error: "lesson not found" };

  const ordered = await db
    .select({ id: lessons.id, sortOrder: lessons.sortOrder })
    .from(lessons)
    .orderBy(lessons.sortOrder);
  const idx = ordered.findIndex((l) => l.id === current.id);
  const neighbourIdx = input.direction === "up" ? idx - 1 : idx + 1;
  if (neighbourIdx < 0 || neighbourIdx >= ordered.length) {
    return { ok: true, noop: true };
  }
  const neighbour = ordered[neighbourIdx];

  // Swap in a transaction so concurrent reorders can't leave the list
  // half-applied (Postgres unique-violation safe: sortOrder isn't unique).
  await db.transaction(async (tx) => {
    await tx
      .update(lessons)
      .set({ sortOrder: neighbour.sortOrder })
      .where(eq(lessons.id, current.id));
    await tx
      .update(lessons)
      .set({ sortOrder: current.sortOrder })
      .where(eq(lessons.id, neighbour.id));
  });

  revalidatePath("/admin/lessons");
  return { ok: true };
}

export async function togglePublish(lessonId: string, isPublished: boolean) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" };
  }
  await db
    .update(lessons)
    .set({ isPublished })
    .where(eq(lessons.id, lessonId));
  revalidatePath("/admin/lessons");
  revalidatePath(`/admin/lessons/${lessonId}`);
  return { ok: true };
}

export async function assignToClient(lessonId: string, clientId: string) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" };
  }
  await db
    .insert(clientLessons)
    .values({ lessonId, clientId })
    .onConflictDoNothing();
  revalidatePath("/admin/lessons");
  revalidatePath(`/admin/lessons/${lessonId}`);
  return { ok: true };
}

export async function unassignFromClient(lessonId: string, clientId: string) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" };
  }
  await db
    .delete(clientLessons)
    .where(
      and(
        eq(clientLessons.lessonId, lessonId),
        eq(clientLessons.clientId, clientId),
      ),
    );
  revalidatePath("/admin/lessons");
  revalidatePath(`/admin/lessons/${lessonId}`);
  return { ok: true };
}

export async function deleteLesson(lessonId: string) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" };
  }
  await db.delete(lessons).where(eq(lessons.id, lessonId));
  revalidatePath("/admin/lessons");
  return { ok: true };
}
