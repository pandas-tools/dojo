/**
 * scopedDb(user) — tenant-isolation wrapper around the Drizzle client.
 *
 * Every employee-facing query must go through this wrapper. It auto-injects
 * `where client_id = user.clientId` on every tenant-scoped read and refuses
 * to act if the user has no clientId (admins should use the raw `db` client
 * with explicit authorization checks).
 *
 * Phase 1 stub — the full implementation lands in Phase 2 alongside the
 * employee API routes. Integration test `src/tests/tenant-isolation.test.ts`
 * (also Phase 2) is the contract.
 */

import { eq, and, inArray } from "drizzle-orm";
import { db } from "./client";
import {
  clientLessons,
  lessons,
  lessonTranslations,
  lessonCompletions,
  lessonEvents,
  stores,
  clients,
  clientLanguages,
} from "./schema";

type LessonEventType =
  | "lesson_opened"
  | "lesson_completed"
  | "lesson_engagement"
  | "rating_submitted";

type LessonContentType = "video" | "image" | "carousel";

// Translation is "media-complete" for a given content_type when it has the
// asset the viewer needs to render anything useful — Mux playback id for
// video, image_url for image, at least 2 carousel slides for carousel.
// Used by the forLesson/forLessons translation resolvers to silently
// fall back to English when the preferred-language row exists but has
// no media (e.g. admin created a French placeholder but never uploaded).
function isTranslationMediaComplete(
  t: typeof lessonTranslations.$inferSelect,
  contentType: LessonContentType,
): boolean {
  if (contentType === "video") return !!t.muxPlaybackId;
  if (contentType === "image") return !!t.imageUrl;
  const slides = Array.isArray(t.carouselSlides) ? t.carouselSlides : [];
  return slides.length >= 2;
}

export type ScopedUser = {
  id: string;
  clientId: string;
  role: "employee" | "admin" | "client_admin";
};

export function scopedDb(user: ScopedUser) {
  if (!user.clientId) {
    throw new Error("scopedDb requires a clientId");
  }
  const cid = user.clientId;

  return {
    raw: db, // escape hatch; usage outside this module = code review block
    cid,

    client: {
      get: () =>
        db.query.clients.findFirst({
          where: eq(clients.id, cid),
        }),
    },

    languages: {
      list: () =>
        db.query.clientLanguages.findMany({
          where: eq(clientLanguages.clientId, cid),
        }),
    },

    stores: {
      list: () =>
        db.query.stores.findMany({
          where: and(eq(stores.clientId, cid), eq(stores.isActive, true)),
        }),
    },

    lessons: {
      // List published lessons assigned to this client
      list: async () => {
        const assignments = await db
          .select({ lessonId: clientLessons.lessonId })
          .from(clientLessons)
          .where(eq(clientLessons.clientId, cid));
        const ids = assignments.map((a) => a.lessonId);
        if (ids.length === 0) return [];
        return db.query.lessons.findMany({
          where: and(inArray(lessons.id, ids), eq(lessons.isPublished, true)),
          orderBy: (l, { asc }) => [asc(l.sortOrder)],
        });
      },
      // Verify a lesson belongs to this client before returning
      getById: async (lessonId: string) => {
        const [assignment] = await db
          .select()
          .from(clientLessons)
          .where(
            and(
              eq(clientLessons.clientId, cid),
              eq(clientLessons.lessonId, lessonId),
            ),
          );
        if (!assignment) return null;
        return db.query.lessons.findFirst({
          where: and(eq(lessons.id, lessonId), eq(lessons.isPublished, true)),
        });
      },
    },

    translations: {
      // Get translation for a lesson in a preferred language, with media-aware
      // English fallback. Returns the preferred translation iff (a) its row
      // exists AND (b) it's media-complete for the lesson's content_type;
      // otherwise returns English. This means an FR placeholder admin
      // created but never uploaded silently shows EN instead of an empty
      // viewer — exactly what an employee should see.
      forLesson: async (lessonId: string, preferred: string) => {
        // Check the lesson is assigned to this client
        const [assignment] = await db
          .select()
          .from(clientLessons)
          .where(
            and(
              eq(clientLessons.clientId, cid),
              eq(clientLessons.lessonId, lessonId),
            ),
          );
        if (!assignment) return null;

        const lesson = await db.query.lessons.findFirst({
          where: eq(lessons.id, lessonId),
        });
        if (!lesson) return null;

        const all = await db.query.lessonTranslations.findMany({
          where: eq(lessonTranslations.lessonId, lessonId),
        });
        const en = all.find((t) => t.language === "en") ?? null;
        const inPreferred = all.find((t) => t.language === preferred);
        if (
          inPreferred &&
          isTranslationMediaComplete(
            inPreferred,
            lesson.contentType as LessonContentType,
          )
        ) {
          return inPreferred;
        }
        return en;
      },

      /**
       * Batch sibling of forLesson(). For a list of lesson IDs (which must
       * already be filtered to this client's assigned lessons — typically
       * the result of lessons.list()), returns a Map keyed by lessonId of
       * the best-matching translation in `preferred` with EN fallback.
       *
       * Two queries total (vs. 2N from calling forLesson in a loop):
       *   1. client_lessons → filter input ids to this client's assignments
       *   2. lesson_translations → all translations for those lessons
       */
      forLessons: async (
        lessonIds: string[],
        preferred: string,
      ): Promise<Map<string, typeof lessonTranslations.$inferSelect>> => {
        const out = new Map<string, typeof lessonTranslations.$inferSelect>();
        if (lessonIds.length === 0) return out;
        const assignments = await db
          .select()
          .from(clientLessons)
          .where(eq(clientLessons.clientId, cid));
        const assignedSet = new Set(assignments.map((a) => a.lessonId));
        const safeIds = lessonIds.filter((id) => assignedSet.has(id));
        if (safeIds.length === 0) return out;
        const [lessonRows, all] = await Promise.all([
          db.query.lessons.findMany({
            where: (l, { inArray }) => inArray(l.id, safeIds),
          }),
          db.query.lessonTranslations.findMany({
            where: (t, { inArray }) => inArray(t.lessonId, safeIds),
          }),
        ]);
        const contentTypeByLesson = new Map<string, LessonContentType>(
          lessonRows.map((l) => [l.id, l.contentType as LessonContentType]),
        );
        const byLesson = new Map<
          string,
          (typeof lessonTranslations.$inferSelect)[]
        >();
        for (const t of all) {
          const arr = byLesson.get(t.lessonId) ?? [];
          arr.push(t);
          byLesson.set(t.lessonId, arr);
        }
        for (const id of safeIds) {
          const ct = contentTypeByLesson.get(id);
          if (!ct) continue;
          const candidates = byLesson.get(id) ?? [];
          const pref = candidates.find((t) => t.language === preferred);
          const en = candidates.find((t) => t.language === "en");
          const chosen =
            pref && isTranslationMediaComplete(pref, ct) ? pref : en;
          if (chosen) out.set(id, chosen);
        }
        return out;
      },
    },

    completions: {
      // Returns the user's RATINGS, restricted to lessons currently
      // assigned to their client. Stale completions from a previous
      // client (if the user were ever reassigned in the DB) are filtered
      // out so /browse and /watch never resurface them.
      //
      // Naming note: this table is now semantically "ratings" — the
      // boolean "did they complete it" signal moved into lesson_events.
      // Kept the name for back-compat with existing call sites; we'll
      // rename in a follow-up bundle if the signal:noise warrants.
      forUser: async () => {
        const assignments = await db
          .select({ lessonId: clientLessons.lessonId })
          .from(clientLessons)
          .where(eq(clientLessons.clientId, cid));
        const assignedIds = assignments.map((a) => a.lessonId);
        if (assignedIds.length === 0) return [];
        return db.query.lessonCompletions.findMany({
          where: and(
            eq(lessonCompletions.userId, user.id),
            inArray(lessonCompletions.lessonId, assignedIds),
          ),
        });
      },
      upsert: async (lessonId: string, rating: number) => {
        // Verify lesson is assigned to user's client first
        const [assignment] = await db
          .select()
          .from(clientLessons)
          .where(
            and(
              eq(clientLessons.clientId, cid),
              eq(clientLessons.lessonId, lessonId),
            ),
          );
        if (!assignment) {
          throw new Error("Lesson not assigned to user's client");
        }
        if (rating < 1 || rating > 5) {
          throw new Error("Rating must be between 1 and 5");
        }
        return db
          .insert(lessonCompletions)
          .values({
            userId: user.id,
            lessonId,
            rating,
          })
          .onConflictDoUpdate({
            target: [lessonCompletions.userId, lessonCompletions.lessonId],
            set: { rating, completedAt: new Date() },
          })
          .returning();
      },
    },

    events: {
      // Append a tracker event for a lesson the user has access to.
      // Verifies the lesson is currently assigned to this client first —
      // refuses to write an event for a lesson the user can't actually
      // see (defensive against a stale tab + a re-assignment that already
      // happened on the admin side).
      //
      // For lesson_opened and lesson_completed we de-dupe per (user,
      // lesson) so the tracker can safely re-emit on retries — first one
      // wins. lesson_engagement and rating_submitted always insert.
      write: async (
        lessonId: string,
        eventType: LessonEventType,
        payload: Record<string, unknown> | null,
      ) => {
        const [assignment] = await db
          .select()
          .from(clientLessons)
          .where(
            and(
              eq(clientLessons.clientId, cid),
              eq(clientLessons.lessonId, lessonId),
            ),
          );
        if (!assignment) {
          throw new Error("Lesson not assigned to user's client");
        }

        const dedupable =
          eventType === "lesson_opened" || eventType === "lesson_completed";
        if (dedupable) {
          const [existing] = await db
            .select({ id: lessonEvents.id })
            .from(lessonEvents)
            .where(
              and(
                eq(lessonEvents.userId, user.id),
                eq(lessonEvents.lessonId, lessonId),
                eq(lessonEvents.eventType, eventType),
              ),
            )
            .limit(1);
          if (existing) return existing;
        }

        const [row] = await db
          .insert(lessonEvents)
          .values({
            userId: user.id,
            lessonId,
            clientId: cid,
            eventType,
            payload,
          })
          .returning({ id: lessonEvents.id });
        return row;
      },

      // Read all lesson_completed events for the user's currently-assigned
      // lessons. Used by /browse and /watch to mark which lessons are
      // already "done" for this user. Replaces the previous "rating row
      // exists = completed" signal.
      completedLessonIds: async (): Promise<Set<string>> => {
        const assignments = await db
          .select({ lessonId: clientLessons.lessonId })
          .from(clientLessons)
          .where(eq(clientLessons.clientId, cid));
        const assignedIds = assignments.map((a) => a.lessonId);
        if (assignedIds.length === 0) return new Set();
        const rows = await db
          .select({ lessonId: lessonEvents.lessonId })
          .from(lessonEvents)
          .where(
            and(
              eq(lessonEvents.userId, user.id),
              eq(lessonEvents.eventType, "lesson_completed"),
              inArray(lessonEvents.lessonId, assignedIds),
            ),
          );
        return new Set(rows.map((r) => r.lessonId));
      },
    },
  };
}
