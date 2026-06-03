"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  lessons,
  lessonTranslations,
  type CarouselSlide,
} from "@/lib/db/schema";
import {
  deleteLessonImage,
  isValidLessonMediaKey,
} from "@/lib/media-storage";
import { writeAuditEntry } from "@/lib/audit-log";
import { readMuxUploadState } from "@/lib/mux";

// Convert a stored media URL back into its bucket key, or null if the URL
// isn't one we own (defends against trying to delete external/legacy URLs).
function keyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const prefix = "/api/media/";
  if (!url.startsWith(prefix)) return null;
  const key = url.slice(prefix.length);
  return isValidLessonMediaKey(key) ? key : null;
}

// True if any OTHER translation on this lesson still references the URL on
// its image_url column. Lets us safely garbage-collect the bucket key when
// an image is swapped/cleared without breaking translations that share it
// (the copyImageFromEnglish flow deliberately produces that sharing).
async function imageUrlStillReferenced(input: {
  lessonId: string;
  url: string;
  excludingTranslationId: string;
}): Promise<boolean> {
  const rows = await db
    .select({ id: lessonTranslations.id })
    .from(lessonTranslations)
    .where(
      and(
        eq(lessonTranslations.lessonId, input.lessonId),
        eq(lessonTranslations.imageUrl, input.url),
      ),
    );
  return rows.some((r) => r.id !== input.excludingTranslationId);
}

// True if any OTHER translation on this lesson still references the URL
// inside its carousel_slides jsonb. Uses Postgres @> containment so the
// match is "any slide whose url equals this URL", caption/alt irrelevant.
async function carouselUrlStillReferenced(input: {
  lessonId: string;
  url: string;
  excludingTranslationId: string;
}): Promise<boolean> {
  const needle = JSON.stringify([{ url: input.url }]);
  const rows = await db
    .select({ id: lessonTranslations.id })
    .from(lessonTranslations)
    .where(
      and(
        eq(lessonTranslations.lessonId, input.lessonId),
        sql`${lessonTranslations.carouselSlides} @> ${needle}::jsonb`,
      ),
    );
  return rows.some((r) => r.id !== input.excludingTranslationId);
}

// Best-effort: delete a bucket key iff no other translation on the lesson
// still references the URL. Swallows errors — orphaned objects are cheap
// (low storage cost, $0 egress) and we never want admin writes to fail
// because of bucket flakiness.
async function maybeGcImageUrl(input: {
  lessonId: string;
  oldUrl: string | null;
  excludingTranslationId: string;
}): Promise<void> {
  const key = keyFromUrl(input.oldUrl);
  if (!key) return;
  const still = await imageUrlStillReferenced({
    lessonId: input.lessonId,
    url: input.oldUrl!,
    excludingTranslationId: input.excludingTranslationId,
  });
  if (still) return;
  await deleteLessonImage(key);
}

async function maybeGcCarouselUrls(input: {
  lessonId: string;
  oldSlides: CarouselSlide[];
  newSlides: CarouselSlide[];
  excludingTranslationId: string;
}): Promise<void> {
  const newUrls = new Set(input.newSlides.map((s) => s.url));
  const removedUrls = input.oldSlides
    .map((s) => s.url)
    .filter((u) => !newUrls.has(u));
  for (const url of removedUrls) {
    const key = keyFromUrl(url);
    if (!key) continue;
    const still = await carouselUrlStillReferenced({
      lessonId: input.lessonId,
      url,
      excludingTranslationId: input.excludingTranslationId,
    });
    if (still) continue;
    await deleteLessonImage(key);
  }
}

async function requireAdminLesson(lessonId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("forbidden");
  }
  const [lesson] = await db
    .select()
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1);
  if (!lesson) throw new Error("Lesson not found");
  return { session, lesson };
}

const SUPPORTED_LANGUAGES = ["en", "fr", "nl", "de", "es", "it", "pt"] as const;
type Lang = (typeof SUPPORTED_LANGUAGES)[number];

function isSupportedLang(value: string): value is Lang {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export async function addTranslation(input: {
  lessonId: string;
  language: string;
  title: string;
  description?: string;
  notesMarkdown?: string;
}) {
  try {
    await requireAdminLesson(input.lessonId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "forbidden" };
  }
  if (!isSupportedLang(input.language)) {
    return { error: `Language "${input.language}" is not supported` };
  }
  const title = input.title.trim();
  if (!title) return { error: "Title is required" };

  // Reject duplicates (also enforced by unique constraint)
  const [existing] = await db
    .select()
    .from(lessonTranslations)
    .where(
      and(
        eq(lessonTranslations.lessonId, input.lessonId),
        eq(lessonTranslations.language, input.language),
      ),
    )
    .limit(1);
  if (existing) {
    return { error: `A "${input.language}" translation already exists` };
  }

  const [created] = await db
    .insert(lessonTranslations)
    .values({
      lessonId: input.lessonId,
      language: input.language,
      title,
      description: input.description?.trim() || null,
      notesMarkdown: input.notesMarkdown?.trim() || null,
    })
    .returning();
  await writeAuditEntry({
    action: "translation.add",
    targetType: "translation",
    targetId: created.id,
    payload: { lessonId: input.lessonId, language: input.language, title },
  });
  revalidatePath("/admin/lessons");
  revalidatePath(`/admin/lessons/${input.lessonId}`);
  return { ok: true, translationId: created.id };
}

export async function updateTranslation(input: {
  translationId: string;
  lessonId: string;
  title?: string;
  description?: string | null;
  notesMarkdown?: string | null;
}) {
  try {
    await requireAdminLesson(input.lessonId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "forbidden" };
  }
  const [t] = await db
    .select()
    .from(lessonTranslations)
    .where(eq(lessonTranslations.id, input.translationId))
    .limit(1);
  if (!t || t.lessonId !== input.lessonId) {
    return { error: "Translation does not belong to this lesson" };
  }
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) return { error: "Title cannot be empty" };
    patch.title = title;
  }
  if (input.description !== undefined)
    patch.description = input.description?.trim() || null;
  if (input.notesMarkdown !== undefined)
    patch.notesMarkdown = input.notesMarkdown?.trim() || null;

  await db
    .update(lessonTranslations)
    .set(patch)
    .where(eq(lessonTranslations.id, input.translationId));
  await writeAuditEntry({
    action: "translation.update",
    targetType: "translation",
    targetId: input.translationId,
    payload: { lessonId: input.lessonId, language: t.language, patch },
  });
  revalidatePath(`/admin/lessons/${input.lessonId}`);
  return { ok: true };
}

export async function deleteTranslation(input: {
  translationId: string;
  lessonId: string;
}) {
  try {
    await requireAdminLesson(input.lessonId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "forbidden" };
  }
  const [t] = await db
    .select()
    .from(lessonTranslations)
    .where(eq(lessonTranslations.id, input.translationId))
    .limit(1);
  if (!t || t.lessonId !== input.lessonId) {
    return { error: "Translation does not belong to this lesson" };
  }
  if (t.language === "en") {
    return {
      error:
        "The English translation is required (system-wide fallback). Edit it instead.",
    };
  }
  await db
    .delete(lessonTranslations)
    .where(eq(lessonTranslations.id, input.translationId));
  await writeAuditEntry({
    action: "translation.delete",
    targetType: "translation",
    targetId: input.translationId,
    payload: { lessonId: input.lessonId, language: t.language, title: t.title },
  });
  revalidatePath(`/admin/lessons/${input.lessonId}`);
  revalidatePath("/admin/lessons");
  return { ok: true };
}

/**
 * Share the English translation's Mux asset with another translation.
 * Use case: same video, different subtitle track (Mux auto-generates subtitles
 * per-asset, so to get a French subtitle track you'd normally re-upload).
 * For simple "subtitled" mode where the language difference is only in title +
 * description + notes (the video itself stays English), this copies the asset.
 */
export async function copyMuxFromEnglish(input: {
  translationId: string;
  lessonId: string;
}) {
  try {
    await requireAdminLesson(input.lessonId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "forbidden" };
  }
  const [t] = await db
    .select()
    .from(lessonTranslations)
    .where(eq(lessonTranslations.id, input.translationId))
    .limit(1);
  if (!t || t.lessonId !== input.lessonId) {
    return { error: "Translation does not belong to this lesson" };
  }
  if (t.language === "en") {
    return { error: "Cannot copy English onto itself" };
  }
  const [en] = await db
    .select()
    .from(lessonTranslations)
    .where(
      and(
        eq(lessonTranslations.lessonId, input.lessonId),
        eq(lessonTranslations.language, "en"),
      ),
    )
    .limit(1);
  if (!en || !en.muxPlaybackId) {
    return { error: "English video isn't ready yet — upload it first" };
  }
  await db
    .update(lessonTranslations)
    .set({
      muxAssetId: en.muxAssetId,
      muxPlaybackId: en.muxPlaybackId,
      muxUploadId: null,
      durationSeconds: en.durationSeconds,
      thumbnailUrl: en.thumbnailUrl,
      muxErrorMessage: null,
      aspectRatio: en.aspectRatio,
    })
    .where(eq(lessonTranslations.id, input.translationId));
  await writeAuditEntry({
    action: "translation.video.copy_from_en",
    targetType: "translation",
    targetId: input.translationId,
    payload: { lessonId: input.lessonId, language: t.language },
  });
  revalidatePath(`/admin/lessons/${input.lessonId}`);
  revalidatePath("/admin/lessons");
  return { ok: true };
}

/**
 * Clear the Mux fields on a translation so a new upload can begin from scratch.
 * Doesn't delete the Mux asset itself (that lives on Mux's side and continues
 * to serve playback for any other translation that still references it).
 */
export async function clearMux(input: {
  translationId: string;
  lessonId: string;
}) {
  try {
    await requireAdminLesson(input.lessonId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "forbidden" };
  }
  const [t] = await db
    .select()
    .from(lessonTranslations)
    .where(eq(lessonTranslations.id, input.translationId))
    .limit(1);
  if (!t || t.lessonId !== input.lessonId) {
    return { error: "Translation does not belong to this lesson" };
  }
  await db
    .update(lessonTranslations)
    .set({
      muxAssetId: null,
      muxPlaybackId: null,
      muxUploadId: null,
      durationSeconds: null,
      thumbnailUrl: null,
      muxErrorMessage: null,
      aspectRatio: null,
    })
    .where(eq(lessonTranslations.id, input.translationId));
  await writeAuditEntry({
    action: "translation.video.clear",
    targetType: "translation",
    targetId: input.translationId,
    payload: { lessonId: input.lessonId, language: t.language },
  });
  revalidatePath(`/admin/lessons/${input.lessonId}`);
  return { ok: true };
}

/**
 * Recovery action for video translations stuck in ⏳ — fetch the actual
 * state from Mux and sync the DB row accordingly. Use when a webhook
 * was missed (network glitch, Mux outage) or fired with an error we
 * want to surface.
 *
 * Returns the resolved status so the admin UI can show the outcome:
 *   - "ready":     filled in playback_id/duration/thumbnail, cleared error
 *   - "errored":   stored mux_error_message so the UI can show "Failed: …"
 *                  plus a "Clear & re-upload" option
 *   - "preparing": no DB change; Mux is still processing
 *   - "unknown":   couldn't find the upload/asset on Mux
 */
export async function resyncMuxUpload(input: {
  translationId: string;
  lessonId: string;
}) {
  try {
    await requireAdminLesson(input.lessonId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "forbidden" };
  }
  const [t] = await db
    .select()
    .from(lessonTranslations)
    .where(eq(lessonTranslations.id, input.translationId))
    .limit(1);
  if (!t || t.lessonId !== input.lessonId) {
    return { error: "Translation does not belong to this lesson" };
  }
  if (!t.muxUploadId) {
    return { error: "Nothing to resync — no Mux upload has been started" };
  }

  const state = await readMuxUploadState(t.muxUploadId);

  if (state.status === "ready" && state.playbackId) {
    await db
      .update(lessonTranslations)
      .set({
        muxPlaybackId: state.playbackId,
        durationSeconds: state.durationSeconds ?? t.durationSeconds,
        thumbnailUrl: state.thumbnailUrl,
        muxErrorMessage: null,
        aspectRatio: state.aspectRatio ?? t.aspectRatio,
      })
      .where(eq(lessonTranslations.id, input.translationId));
  } else if (state.status === "errored") {
    await db
      .update(lessonTranslations)
      .set({ muxErrorMessage: state.errorMessage })
      .where(eq(lessonTranslations.id, input.translationId));
  } else if (state.status === "unknown") {
    await db
      .update(lessonTranslations)
      .set({ muxErrorMessage: state.errorMessage })
      .where(eq(lessonTranslations.id, input.translationId));
  }
  // "preparing" → leave DB alone; admin can resync again later.

  await writeAuditEntry({
    action: "translation.video.resync",
    targetType: "translation",
    targetId: input.translationId,
    payload: {
      lessonId: input.lessonId,
      language: t.language,
      resolved: state.status,
      errorMessage: state.errorMessage ?? null,
    },
  });

  revalidatePath(`/admin/lessons/${input.lessonId}`);
  return { ok: true as const, status: state.status, error: state.errorMessage };
}

// ---------------------------------------------------------------------------
// Image lesson translation surface
// ---------------------------------------------------------------------------

/**
 * Swap the image on an image-lesson translation. Expects an already-uploaded
 * image (the client POSTs to /api/admin/lessons/upload-image first and
 * passes the returned proxy URL in). Server replaces image_url + image_alt,
 * then garbage-collects the old bucket object iff no other translation on
 * this lesson still references it.
 */
export async function updateImageLesson(input: {
  translationId: string;
  lessonId: string;
  imageUrl: string;
  imageAlt: string;
  /** Width / height of the new image — from the upload endpoint response. */
  aspectRatio?: number | null;
}) {
  try {
    await requireAdminLesson(input.lessonId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "forbidden" };
  }
  const imageUrl = input.imageUrl.trim();
  const imageAlt = input.imageAlt.trim();
  if (!imageUrl) return { error: "imageUrl is required" };
  if (!imageAlt) return { error: "imageAlt is required" };

  const [t] = await db
    .select()
    .from(lessonTranslations)
    .where(eq(lessonTranslations.id, input.translationId))
    .limit(1);
  if (!t || t.lessonId !== input.lessonId) {
    return { error: "Translation does not belong to this lesson" };
  }

  const oldUrl = t.imageUrl;
  const aspectRatio =
    typeof input.aspectRatio === "number" &&
    Number.isFinite(input.aspectRatio) &&
    input.aspectRatio > 0
      ? input.aspectRatio
      : null;

  await db
    .update(lessonTranslations)
    .set({ imageUrl, imageAlt, aspectRatio })
    .where(eq(lessonTranslations.id, input.translationId));

  if (oldUrl && oldUrl !== imageUrl) {
    await maybeGcImageUrl({
      lessonId: input.lessonId,
      oldUrl,
      excludingTranslationId: input.translationId,
    });
  }

  await writeAuditEntry({
    action: "translation.image.update",
    targetType: "translation",
    targetId: input.translationId,
    payload: { lessonId: input.lessonId, language: t.language, oldUrl, newUrl: imageUrl },
  });
  revalidatePath(`/admin/lessons/${input.lessonId}`);
  revalidatePath("/admin/lessons");
  return { ok: true };
}

/**
 * Clear the image fields on an image-lesson translation so a new upload can
 * begin from scratch. Garbage-collects the bucket key if no other translation
 * on this lesson references it.
 */
export async function clearImage(input: {
  translationId: string;
  lessonId: string;
}) {
  try {
    await requireAdminLesson(input.lessonId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "forbidden" };
  }
  const [t] = await db
    .select()
    .from(lessonTranslations)
    .where(eq(lessonTranslations.id, input.translationId))
    .limit(1);
  if (!t || t.lessonId !== input.lessonId) {
    return { error: "Translation does not belong to this lesson" };
  }

  const oldUrl = t.imageUrl;

  await db
    .update(lessonTranslations)
    .set({ imageUrl: null, imageAlt: null, aspectRatio: null })
    .where(eq(lessonTranslations.id, input.translationId));

  if (oldUrl) {
    await maybeGcImageUrl({
      lessonId: input.lessonId,
      oldUrl,
      excludingTranslationId: input.translationId,
    });
  }

  await writeAuditEntry({
    action: "translation.image.clear",
    targetType: "translation",
    targetId: input.translationId,
    payload: { lessonId: input.lessonId, language: t.language, oldUrl },
  });
  revalidatePath(`/admin/lessons/${input.lessonId}`);
  return { ok: true };
}

/**
 * Point this translation's image at the English translation's image (same
 * url + alt). Mirror of copyMuxFromEnglish — admin's escape hatch when the
 * non-EN translation differs only in text.
 */
export async function copyImageFromEnglish(input: {
  translationId: string;
  lessonId: string;
}) {
  try {
    await requireAdminLesson(input.lessonId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "forbidden" };
  }
  const [t] = await db
    .select()
    .from(lessonTranslations)
    .where(eq(lessonTranslations.id, input.translationId))
    .limit(1);
  if (!t || t.lessonId !== input.lessonId) {
    return { error: "Translation does not belong to this lesson" };
  }
  if (t.language === "en") {
    return { error: "Cannot copy English onto itself" };
  }
  const [en] = await db
    .select()
    .from(lessonTranslations)
    .where(
      and(
        eq(lessonTranslations.lessonId, input.lessonId),
        eq(lessonTranslations.language, "en"),
      ),
    )
    .limit(1);
  if (!en || !en.imageUrl) {
    return { error: "English image isn't set yet — upload it first" };
  }

  const oldUrl = t.imageUrl;

  await db
    .update(lessonTranslations)
    .set({
      imageUrl: en.imageUrl,
      imageAlt: en.imageAlt,
      aspectRatio: en.aspectRatio,
    })
    .where(eq(lessonTranslations.id, input.translationId));

  if (oldUrl && oldUrl !== en.imageUrl) {
    await maybeGcImageUrl({
      lessonId: input.lessonId,
      oldUrl,
      excludingTranslationId: input.translationId,
    });
  }

  await writeAuditEntry({
    action: "translation.image.copy_from_en",
    targetType: "translation",
    targetId: input.translationId,
    payload: { lessonId: input.lessonId, language: t.language },
  });
  revalidatePath(`/admin/lessons/${input.lessonId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Carousel lesson translation surface
// ---------------------------------------------------------------------------

/**
 * Replace the carousel slides on a translation with a new ordered list.
 * Add/remove/reorder are all expressed via the final array — server diffs
 * the URL set vs old to find orphans, then GCs bucket keys no other
 * translation references.
 */
export async function updateCarouselLesson(input: {
  translationId: string;
  lessonId: string;
  slides: CarouselSlide[];
  /** Aspect of the carousel canvas (typically the first slide's). */
  aspectRatio?: number | null;
}) {
  try {
    await requireAdminLesson(input.lessonId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "forbidden" };
  }
  if (!Array.isArray(input.slides) || input.slides.length < 2) {
    return {
      error: "Carousel needs at least 2 slides — use an image lesson for 1.",
    };
  }
  const slides: CarouselSlide[] = [];
  for (const s of input.slides) {
    const url = s.url?.trim();
    const alt = s.alt?.trim();
    if (!url || !alt) {
      return { error: "Every slide needs both url and alt text" };
    }
    slides.push({ url, alt, ...(s.caption ? { caption: s.caption } : {}) });
  }

  const [t] = await db
    .select()
    .from(lessonTranslations)
    .where(eq(lessonTranslations.id, input.translationId))
    .limit(1);
  if (!t || t.lessonId !== input.lessonId) {
    return { error: "Translation does not belong to this lesson" };
  }

  const oldSlides = (t.carouselSlides ?? []) as CarouselSlide[];
  const aspectRatio =
    typeof input.aspectRatio === "number" &&
    Number.isFinite(input.aspectRatio) &&
    input.aspectRatio > 0
      ? input.aspectRatio
      : null;

  await db
    .update(lessonTranslations)
    .set({ carouselSlides: slides, aspectRatio })
    .where(eq(lessonTranslations.id, input.translationId));

  await maybeGcCarouselUrls({
    lessonId: input.lessonId,
    oldSlides,
    newSlides: slides,
    excludingTranslationId: input.translationId,
  });

  await writeAuditEntry({
    action: "translation.carousel.update",
    targetType: "translation",
    targetId: input.translationId,
    payload: {
      lessonId: input.lessonId,
      language: t.language,
      oldSlideCount: oldSlides.length,
      newSlideCount: slides.length,
    },
  });
  revalidatePath(`/admin/lessons/${input.lessonId}`);
  revalidatePath("/admin/lessons");
  return { ok: true };
}

/**
 * Clear the carousel slides on a translation. GCs every previously-stored
 * bucket key that no other translation on this lesson references.
 */
export async function clearCarousel(input: {
  translationId: string;
  lessonId: string;
}) {
  try {
    await requireAdminLesson(input.lessonId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "forbidden" };
  }
  const [t] = await db
    .select()
    .from(lessonTranslations)
    .where(eq(lessonTranslations.id, input.translationId))
    .limit(1);
  if (!t || t.lessonId !== input.lessonId) {
    return { error: "Translation does not belong to this lesson" };
  }

  const oldSlides = (t.carouselSlides ?? []) as CarouselSlide[];

  await db
    .update(lessonTranslations)
    .set({ carouselSlides: null, aspectRatio: null })
    .where(eq(lessonTranslations.id, input.translationId));

  await maybeGcCarouselUrls({
    lessonId: input.lessonId,
    oldSlides,
    newSlides: [],
    excludingTranslationId: input.translationId,
  });

  await writeAuditEntry({
    action: "translation.carousel.clear",
    targetType: "translation",
    targetId: input.translationId,
    payload: { lessonId: input.lessonId, language: t.language, oldSlideCount: oldSlides.length },
  });
  revalidatePath(`/admin/lessons/${input.lessonId}`);
  return { ok: true };
}

/**
 * Point this translation's carousel at the English translation's slides
 * (deep copy of the array). Mirror of copyMuxFromEnglish.
 */
export async function copyCarouselFromEnglish(input: {
  translationId: string;
  lessonId: string;
}) {
  try {
    await requireAdminLesson(input.lessonId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "forbidden" };
  }
  const [t] = await db
    .select()
    .from(lessonTranslations)
    .where(eq(lessonTranslations.id, input.translationId))
    .limit(1);
  if (!t || t.lessonId !== input.lessonId) {
    return { error: "Translation does not belong to this lesson" };
  }
  if (t.language === "en") {
    return { error: "Cannot copy English onto itself" };
  }
  const [en] = await db
    .select()
    .from(lessonTranslations)
    .where(
      and(
        eq(lessonTranslations.lessonId, input.lessonId),
        eq(lessonTranslations.language, "en"),
      ),
    )
    .limit(1);
  const enSlides = (en?.carouselSlides ?? null) as CarouselSlide[] | null;
  if (!enSlides || enSlides.length < 2) {
    return { error: "English carousel isn't set yet — build it first" };
  }

  const oldSlides = (t.carouselSlides ?? []) as CarouselSlide[];
  const newSlides: CarouselSlide[] = enSlides.map((s) => ({
    url: s.url,
    alt: s.alt,
    ...(s.caption ? { caption: s.caption } : {}),
  }));

  await db
    .update(lessonTranslations)
    .set({ carouselSlides: newSlides, aspectRatio: en?.aspectRatio ?? null })
    .where(eq(lessonTranslations.id, input.translationId));

  await maybeGcCarouselUrls({
    lessonId: input.lessonId,
    oldSlides,
    newSlides,
    excludingTranslationId: input.translationId,
  });

  await writeAuditEntry({
    action: "translation.carousel.copy_from_en",
    targetType: "translation",
    targetId: input.translationId,
    payload: { lessonId: input.lessonId, language: t.language, slideCount: newSlides.length },
  });
  revalidatePath(`/admin/lessons/${input.lessonId}`);
  return { ok: true };
}
