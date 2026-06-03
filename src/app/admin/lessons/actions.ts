"use server";

import { and, eq, inArray, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  lessons,
  lessonTranslations,
  clientLessons,
  type CarouselSlide,
} from "@/lib/db/schema";
import { createDirectUpload } from "@/lib/mux";
import { writeAuditEntry } from "@/lib/audit-log";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("forbidden");
  }
  return session;
}

const ALLOWED_LANGS = [
  "en",
  "fr",
  "nl",
  "de",
  "es",
  "it",
  "pt",
] as const;
type AllowedLang = (typeof ALLOWED_LANGS)[number];

const ALLOWED_TYPES = ["training", "announcement", "update"] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

/**
 * Step 1 of the "new lesson with video" flow: ask Mux for a direct upload URL
 * without creating any DB rows yet. The caller uploads the file straight to
 * Mux, holds onto the returned uploadId, and passes it back to
 * createLessonFromUpload() in step 2.
 *
 * Returns null if the user is not an admin (so the client can't enumerate
 * upload URLs).
 */
export async function prepareLessonUpload(input: { language?: string } = {}) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" as const };
  }
  const lang = (input.language ?? "en") as AllowedLang;
  if (!ALLOWED_LANGS.includes(lang)) {
    return { error: "unsupported language" as const };
  }
  const upload = await createDirectUpload({
    corsOrigin: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    language: lang,
  });
  return { ok: true as const, url: upload.url, uploadId: upload.id };
}

/**
 * Step 2 of the "new lesson with video" flow (or step 1 if no video).
 * Creates the lesson + English translation (with muxUploadId attached if
 * present, so the Mux webhook can later find the row by uploadId) +
 * optional empty translations for additional languages + client assignments
 * in one transaction.
 */
export async function createLessonFromUpload(input: {
  uploadId?: string;
  internalName: string;
  title: string;
  description?: string;
  notesMarkdown?: string;
  type?: AllowedType;
  additionalLanguages?: string[];
  clientIds?: string[];
  publish?: boolean;
}) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" as const };
  }
  const internalName = input.internalName.trim();
  const title = input.title.trim();
  if (!internalName || !title) {
    return { error: "internalName and title are required" as const };
  }
  const type: AllowedType = input.type ?? "training";
  if (!ALLOWED_TYPES.includes(type)) {
    return { error: "invalid type" as const };
  }
  const extraLangs = (input.additionalLanguages ?? [])
    .filter((l): l is AllowedLang => (ALLOWED_LANGS as readonly string[]).includes(l))
    .filter((l) => l !== "en");

  // Find next sort_order
  const [{ value: currentMax }] = await db
    .select({ value: max(lessons.sortOrder) })
    .from(lessons);
  const nextSort = (currentMax ?? 0) + 10;

  const lessonId = await db.transaction(async (tx) => {
    const [lesson] = await tx
      .insert(lessons)
      .values({
        internalName,
        type,
        sortOrder: nextSort,
        isPublished: !!input.publish,
      })
      .returning();

    await tx.insert(lessonTranslations).values({
      lessonId: lesson.id,
      language: "en",
      title,
      description: input.description?.trim() || null,
      notesMarkdown: input.notesMarkdown?.trim() || null,
      muxUploadId: input.uploadId ?? null,
    });

    for (const lang of extraLangs) {
      await tx.insert(lessonTranslations).values({
        lessonId: lesson.id,
        language: lang,
        // Seed with the English title so the row is valid; admin can rename later.
        title,
        description: null,
      });
    }

    for (const clientId of input.clientIds ?? []) {
      await tx
        .insert(clientLessons)
        .values({ lessonId: lesson.id, clientId })
        .onConflictDoNothing();
    }

    return lesson.id;
  });

  await writeAuditEntry({
    action: "lesson.create",
    targetType: "lesson",
    targetId: lessonId,
    payload: {
      contentType: "video",
      internalName,
      title,
      type,
      published: !!input.publish,
      uploadId: input.uploadId ?? null,
      clientIds: input.clientIds ?? [],
    },
  });
  revalidatePath("/admin/lessons");
  return { ok: true as const, lessonId };
}

/**
 * Create a single-image lesson. Same shape as createLessonFromUpload but
 * for the 'image' content type — the caller has already uploaded the
 * image to /api/admin/lessons/upload-image and is passing the resulting
 * proxy URL + alt text.
 *
 * Image lessons follow the 5-second-dwell completion rule on the client
 * tracker (decided 2026-06-02). The server doesn't need to know about
 * dwell time; it just stores the media.
 */
export async function createImageLesson(input: {
  imageUrl: string;
  imageAlt: string;
  internalName: string;
  title: string;
  description?: string;
  notesMarkdown?: string;
  type?: AllowedType;
  additionalLanguages?: string[];
  clientIds?: string[];
  publish?: boolean;
}) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" as const };
  }
  const internalName = input.internalName.trim();
  const title = input.title.trim();
  const imageUrl = input.imageUrl.trim();
  const imageAlt = input.imageAlt.trim();
  if (!internalName || !title) {
    return { error: "internalName and title are required" as const };
  }
  if (!imageUrl || !imageAlt) {
    return { error: "imageUrl and imageAlt are required" as const };
  }
  const type: AllowedType = input.type ?? "training";
  if (!ALLOWED_TYPES.includes(type)) {
    return { error: "invalid type" as const };
  }
  const extraLangs = (input.additionalLanguages ?? [])
    .filter((l): l is AllowedLang =>
      (ALLOWED_LANGS as readonly string[]).includes(l),
    )
    .filter((l) => l !== "en");

  const [{ value: currentMax }] = await db
    .select({ value: max(lessons.sortOrder) })
    .from(lessons);
  const nextSort = (currentMax ?? 0) + 10;

  const lessonId = await db.transaction(async (tx) => {
    const [lesson] = await tx
      .insert(lessons)
      .values({
        internalName,
        type,
        contentType: "image",
        sortOrder: nextSort,
        isPublished: !!input.publish,
      })
      .returning();

    await tx.insert(lessonTranslations).values({
      lessonId: lesson.id,
      language: "en",
      title,
      description: input.description?.trim() || null,
      notesMarkdown: input.notesMarkdown?.trim() || null,
      imageUrl,
      imageAlt,
    });

    for (const lang of extraLangs) {
      // Reuse the same image for additional languages by default — admin
      // can swap the per-language image in the translations editor later.
      await tx.insert(lessonTranslations).values({
        lessonId: lesson.id,
        language: lang,
        title,
        description: null,
        imageUrl,
        imageAlt,
      });
    }

    for (const clientId of input.clientIds ?? []) {
      await tx
        .insert(clientLessons)
        .values({ lessonId: lesson.id, clientId })
        .onConflictDoNothing();
    }

    return lesson.id;
  });

  await writeAuditEntry({
    action: "lesson.create",
    targetType: "lesson",
    targetId: lessonId,
    payload: {
      contentType: "image",
      internalName,
      title,
      type,
      published: !!input.publish,
      imageUrl,
      clientIds: input.clientIds ?? [],
    },
  });
  revalidatePath("/admin/lessons");
  return { ok: true as const, lessonId };
}

/**
 * Create a carousel lesson with an ordered array of image slides.
 * Each slide must already be uploaded to ImageKit (the caller hits
 * /api/admin/lessons/upload-image per slide). The slides array carries
 * { url, alt, caption? } in display order.
 *
 * Carousel lessons follow the all-slides-viewed completion rule on the
 * client tracker.
 */
export async function createCarouselLesson(input: {
  slides: CarouselSlide[];
  internalName: string;
  title: string;
  description?: string;
  notesMarkdown?: string;
  type?: AllowedType;
  additionalLanguages?: string[];
  clientIds?: string[];
  publish?: boolean;
}) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" as const };
  }
  const internalName = input.internalName.trim();
  const title = input.title.trim();
  if (!internalName || !title) {
    return { error: "internalName and title are required" as const };
  }
  if (!Array.isArray(input.slides) || input.slides.length < 2) {
    return {
      error: "Carousel needs at least 2 slides — use an image lesson for 1." as const,
    };
  }
  for (const s of input.slides) {
    if (!s.url || !s.alt) {
      return { error: "Every slide needs both url and alt text" as const };
    }
  }
  const type: AllowedType = input.type ?? "training";
  if (!ALLOWED_TYPES.includes(type)) {
    return { error: "invalid type" as const };
  }
  const slides: CarouselSlide[] = input.slides.map((s) => ({
    url: s.url,
    alt: s.alt,
    ...(s.caption ? { caption: s.caption } : {}),
  }));
  const extraLangs = (input.additionalLanguages ?? [])
    .filter((l): l is AllowedLang =>
      (ALLOWED_LANGS as readonly string[]).includes(l),
    )
    .filter((l) => l !== "en");

  const [{ value: currentMax }] = await db
    .select({ value: max(lessons.sortOrder) })
    .from(lessons);
  const nextSort = (currentMax ?? 0) + 10;

  const lessonId = await db.transaction(async (tx) => {
    const [lesson] = await tx
      .insert(lessons)
      .values({
        internalName,
        type,
        contentType: "carousel",
        sortOrder: nextSort,
        isPublished: !!input.publish,
      })
      .returning();

    await tx.insert(lessonTranslations).values({
      lessonId: lesson.id,
      language: "en",
      title,
      description: input.description?.trim() || null,
      notesMarkdown: input.notesMarkdown?.trim() || null,
      carouselSlides: slides,
    });

    for (const lang of extraLangs) {
      await tx.insert(lessonTranslations).values({
        lessonId: lesson.id,
        language: lang,
        title,
        description: null,
        carouselSlides: slides,
      });
    }

    for (const clientId of input.clientIds ?? []) {
      await tx
        .insert(clientLessons)
        .values({ lessonId: lesson.id, clientId })
        .onConflictDoNothing();
    }

    return lesson.id;
  });

  await writeAuditEntry({
    action: "lesson.create",
    targetType: "lesson",
    targetId: lessonId,
    payload: {
      contentType: "carousel",
      internalName,
      title,
      type,
      published: !!input.publish,
      slideCount: slides.length,
      clientIds: input.clientIds ?? [],
    },
  });
  revalidatePath("/admin/lessons");
  return { ok: true as const, lessonId };
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
  await writeAuditEntry({
    action: "lesson.update",
    targetType: "lesson",
    targetId: input.lessonId,
    payload: patch,
  });
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

  await writeAuditEntry({
    action: "lesson.reorder",
    targetType: "lesson",
    targetId: current.id,
    payload: { direction: input.direction, swappedWith: neighbour.id },
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
  await writeAuditEntry({
    action: isPublished ? "lesson.publish" : "lesson.unpublish",
    targetType: "lesson",
    targetId: lessonId,
  });
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
  await writeAuditEntry({
    action: "lesson.assign",
    targetType: "lesson",
    targetId: lessonId,
    payload: { clientId },
  });
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
  await writeAuditEntry({
    action: "lesson.unassign",
    targetType: "lesson",
    targetId: lessonId,
    payload: { clientId },
  });
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
  const [snapshot] = await db
    .select({ internalName: lessons.internalName, contentType: lessons.contentType })
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1);
  await db.delete(lessons).where(eq(lessons.id, lessonId));
  await writeAuditEntry({
    action: "lesson.delete",
    targetType: "lesson",
    targetId: lessonId,
    payload: snapshot ?? null,
  });
  revalidatePath("/admin/lessons");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Bulk operations on lessons (#8 from the admin batch)
//
// Each takes a `lessonIds` array, runs the operation in a transaction so
// the table is never half-mutated, and writes ONE audit-log row carrying
// the full id list. Server-side caps at 200 ids per call to keep an
// accidental click-the-checkbox-on-everything from spawning a runaway
// query — well above any realistic dojo admin workflow.
// ---------------------------------------------------------------------------

const BULK_MAX = 200;

function dedupeIds(ids: string[]): string[] {
  return Array.from(new Set(ids.filter((id) => typeof id === "string" && id.length > 0)));
}

export async function bulkSetPublish(input: {
  lessonIds: string[];
  isPublished: boolean;
}) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" };
  }
  const ids = dedupeIds(input.lessonIds);
  if (ids.length === 0) return { error: "Pick at least one lesson" };
  if (ids.length > BULK_MAX) {
    return { error: `Too many lessons in one batch (max ${BULK_MAX})` };
  }
  const result = await db
    .update(lessons)
    .set({ isPublished: input.isPublished })
    .where(inArray(lessons.id, ids))
    .returning({ id: lessons.id });
  await writeAuditEntry({
    action: input.isPublished ? "lesson.bulk_publish" : "lesson.bulk_unpublish",
    targetType: "lesson_set",
    targetId: `${result.length}_lessons`,
    payload: { lessonIds: result.map((r) => r.id), isPublished: input.isPublished },
  });
  revalidatePath("/admin/lessons");
  return { ok: true as const, count: result.length };
}

export async function bulkDelete(input: { lessonIds: string[] }) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" };
  }
  const ids = dedupeIds(input.lessonIds);
  if (ids.length === 0) return { error: "Pick at least one lesson" };
  if (ids.length > BULK_MAX) {
    return { error: `Too many lessons in one batch (max ${BULK_MAX})` };
  }
  // Snapshot internal names for the audit log so we can identify what got
  // deleted even after the rows are gone.
  const snapshot = await db
    .select({ id: lessons.id, internalName: lessons.internalName })
    .from(lessons)
    .where(inArray(lessons.id, ids));
  const result = await db
    .delete(lessons)
    .where(inArray(lessons.id, ids))
    .returning({ id: lessons.id });
  await writeAuditEntry({
    action: "lesson.bulk_delete",
    targetType: "lesson_set",
    targetId: `${result.length}_lessons`,
    payload: { lessonIds: result.map((r) => r.id), snapshot },
  });
  revalidatePath("/admin/lessons");
  return { ok: true as const, count: result.length };
}

export async function bulkAssignToClient(input: {
  lessonIds: string[];
  clientId: string;
}) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" };
  }
  const ids = dedupeIds(input.lessonIds);
  if (ids.length === 0) return { error: "Pick at least one lesson" };
  if (ids.length > BULK_MAX) {
    return { error: `Too many lessons in one batch (max ${BULK_MAX})` };
  }
  const result = await db
    .insert(clientLessons)
    .values(ids.map((lessonId) => ({ lessonId, clientId: input.clientId })))
    .onConflictDoNothing()
    .returning({ lessonId: clientLessons.lessonId });
  await writeAuditEntry({
    action: "lesson.bulk_assign",
    targetType: "lesson_set",
    targetId: `${result.length}_lessons`,
    payload: { lessonIds: result.map((r) => r.lessonId), clientId: input.clientId },
  });
  revalidatePath("/admin/lessons");
  revalidatePath(`/admin/clients/${input.clientId}`);
  return { ok: true as const, count: result.length };
}

export async function bulkUnassignFromClient(input: {
  lessonIds: string[];
  clientId: string;
}) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" };
  }
  const ids = dedupeIds(input.lessonIds);
  if (ids.length === 0) return { error: "Pick at least one lesson" };
  if (ids.length > BULK_MAX) {
    return { error: `Too many lessons in one batch (max ${BULK_MAX})` };
  }
  const result = await db
    .delete(clientLessons)
    .where(
      and(
        eq(clientLessons.clientId, input.clientId),
        inArray(clientLessons.lessonId, ids),
      ),
    )
    .returning({ lessonId: clientLessons.lessonId });
  await writeAuditEntry({
    action: "lesson.bulk_unassign",
    targetType: "lesson_set",
    targetId: `${result.length}_lessons`,
    payload: { lessonIds: result.map((r) => r.lessonId), clientId: input.clientId },
  });
  revalidatePath("/admin/lessons");
  revalidatePath(`/admin/clients/${input.clientId}`);
  return { ok: true as const, count: result.length };
}
