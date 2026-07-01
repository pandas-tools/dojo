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
  lessonGroups,
  lessonBookmarks,
  lessonUpvotes,
  lessonGroupRatings,
  lessonTranslations,
  lessonEvents,
  stores,
  clients,
  clientLanguages,
  users,
} from "./schema";
import { classifyTier } from "@/lib/tiers";
import { getTierConfig } from "@/lib/tiers-data";

// Event types that new code is allowed to WRITE. `rating_submitted` is
// intentionally absent — it's a historical value preserved in the postgres
// enum for legacy rows but no longer accepted from clients or new code paths.
type LessonEventType =
  | "lesson_opened"
  | "lesson_completed"
  | "lesson_engagement"
  | "lesson_upvoted"
  | "lesson_unvoted"
  | "group_rated";

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

    // The current user's own profile bits. Keyed by user.id (not tenant-scoped
    // by client_id — it's the caller's own row), used by /browse for the
    // "New lessons" rail high-water mark.
    me: {
      // Last time the new-lessons check ran for this user; null = never (first
      // visit → every published lesson counts as new that one time).
      getNewLessonsCheckpoint: async (): Promise<Date | null> => {
        const [row] = await db
          .select({ at: users.lastNewLessonsCheckedAt })
          .from(users)
          .where(eq(users.id, user.id))
          .limit(1);
        return row?.at ?? null;
      },
      // Bump the high-water mark to `now`. Best-effort: callers swallow errors
      // so a failed bump never breaks the page (the user just sees the same
      // rail again next load).
      bumpNewLessonsCheckpoint: async (now: Date): Promise<void> => {
        await db
          .update(users)
          .set({ lastNewLessonsCheckedAt: now })
          .where(eq(users.id, user.id));
      },
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

    groups: {
      // All editorial sections, ordered for display. Groups are global
      // reference data (no client_id) so there's nothing tenant-specific to
      // filter here — the browse read drops any group that ends up with no
      // visible lessons for this client after lessons.list() scoping.
      list: () =>
        db.query.lessonGroups.findMany({
          orderBy: (g, { asc }) => [asc(g.sortOrder), asc(g.createdAt)],
        }),
    },

    bookmarks: {
      // Set of lesson IDs this user has bookmarked, restricted to lessons
      // currently assigned to their client so a bookmark on a since-
      // unassigned lesson never resurfaces on /browse.
      forUser: async (): Promise<Set<string>> => {
        const assignments = await db
          .select({ lessonId: clientLessons.lessonId })
          .from(clientLessons)
          .where(eq(clientLessons.clientId, cid));
        const assignedIds = assignments.map((a) => a.lessonId);
        if (assignedIds.length === 0) return new Set();
        const rows = await db
          .select({ lessonId: lessonBookmarks.lessonId })
          .from(lessonBookmarks)
          .where(
            and(
              eq(lessonBookmarks.userId, user.id),
              inArray(lessonBookmarks.lessonId, assignedIds),
            ),
          );
        return new Set(rows.map((r) => r.lessonId));
      },

      // Toggle the bookmark for a lesson the user can actually see. Verifies
      // the lesson is assigned to this client first (defence-in-depth, mirrors
      // events.write / upvotes.toggle). Returns the resulting state.
      toggle: async (lessonId: string): Promise<{ bookmarked: boolean }> => {
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
        const [existing] = await db
          .select({ userId: lessonBookmarks.userId })
          .from(lessonBookmarks)
          .where(
            and(
              eq(lessonBookmarks.userId, user.id),
              eq(lessonBookmarks.lessonId, lessonId),
            ),
          )
          .limit(1);
        if (existing) {
          await db
            .delete(lessonBookmarks)
            .where(
              and(
                eq(lessonBookmarks.userId, user.id),
                eq(lessonBookmarks.lessonId, lessonId),
              ),
            );
          return { bookmarked: false };
        }
        await db
          .insert(lessonBookmarks)
          .values({ userId: user.id, lessonId })
          .onConflictDoNothing();
        return { bookmarked: true };
      },
    },

    upvotes: {
      // Set of lesson IDs this user has upvoted, restricted to lessons
      // currently assigned to their client so an upvote on a since-unassigned
      // lesson never resurfaces. Mirrors bookmarks.forUser exactly.
      forUser: async (): Promise<Set<string>> => {
        const assignments = await db
          .select({ lessonId: clientLessons.lessonId })
          .from(clientLessons)
          .where(eq(clientLessons.clientId, cid));
        const assignedIds = assignments.map((a) => a.lessonId);
        if (assignedIds.length === 0) return new Set();
        const rows = await db
          .select({ lessonId: lessonUpvotes.lessonId })
          .from(lessonUpvotes)
          .where(
            and(
              eq(lessonUpvotes.userId, user.id),
              inArray(lessonUpvotes.lessonId, assignedIds),
            ),
          );
        return new Set(rows.map((r) => r.lessonId));
      },

      // Toggle the upvote for a lesson the user can actually see. Verifies
      // the lesson is assigned to this client first (defence-in-depth, mirrors
      // bookmarks.toggle). Also appends an entry to lesson_events so the
      // append-only log carries the audit trail (who upvoted/unvoted when),
      // independent of the current-state row in lesson_upvotes. Returns the
      // resulting state.
      toggle: async (lessonId: string): Promise<{ upvoted: boolean }> => {
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
        const [existing] = await db
          .select({ userId: lessonUpvotes.userId })
          .from(lessonUpvotes)
          .where(
            and(
              eq(lessonUpvotes.userId, user.id),
              eq(lessonUpvotes.lessonId, lessonId),
            ),
          )
          .limit(1);
        if (existing) {
          await db
            .delete(lessonUpvotes)
            .where(
              and(
                eq(lessonUpvotes.userId, user.id),
                eq(lessonUpvotes.lessonId, lessonId),
              ),
            );
          await db
            .insert(lessonEvents)
            .values({
              userId: user.id,
              lessonId,
              clientId: cid,
              eventType: "lesson_unvoted",
            });
          return { upvoted: false };
        }
        await db
          .insert(lessonUpvotes)
          .values({ userId: user.id, lessonId, clientId: cid })
          .onConflictDoNothing();
        await db
          .insert(lessonEvents)
          .values({
            userId: user.id,
            lessonId,
            clientId: cid,
            eventType: "lesson_upvoted",
          });
        return { upvoted: true };
      },

      // Count of upvotes per lesson, scoped to this user's client. Returns
      // a Map keyed by lessonId. Used by /admin/analytics to surface the
      // per-lesson upvote column in the client detail view. Lessons with
      // zero upvotes are absent from the map (caller defaults to 0).
      countsByLessonForClient: async (): Promise<Map<string, number>> => {
        const rows = await db
          .select({ lessonId: lessonUpvotes.lessonId })
          .from(lessonUpvotes)
          .where(eq(lessonUpvotes.clientId, cid));
        const counts = new Map<string, number>();
        for (const r of rows) {
          counts.set(r.lessonId, (counts.get(r.lessonId) ?? 0) + 1);
        }
        return counts;
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

    groupRatings: {
      // Map of groupId → rating (1-5) for groups in the user's currently
      // assigned curriculum. A group counts as "in the user's curriculum"
      // if it has at least one published lesson assigned to this client.
      // Stale ratings for groups whose lessons are no longer assigned to
      // this client are filtered out so admin drill-down surfaces stay
      // honest.
      forUser: async (): Promise<Map<string, number>> => {
        const rows = await db
          .select({
            groupId: lessonGroupRatings.groupId,
            rating: lessonGroupRatings.rating,
          })
          .from(lessonGroupRatings)
          .where(
            and(
              eq(lessonGroupRatings.userId, user.id),
              eq(lessonGroupRatings.clientId, cid),
            ),
          );
        const out = new Map<string, number>();
        for (const r of rows) out.set(r.groupId, r.rating);
        return out;
      },

      // Upsert the rating for a group the user can actually rate. Verifies
      // the group has at least one published lesson assigned to this client
      // (defence-in-depth; same shape as bookmarks.toggle / upvotes.toggle).
      // Returns the new rating + previousRating so callers can attribute
      // re-rates. Also appends a `group_rated` row to lesson_events so the
      // append-only audit trail mirrors the upvote pattern.
      upsert: async (
        groupId: string,
        rating: number,
      ): Promise<{ rating: number; previousRating: number | null }> => {
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
          throw new Error("Rating must be an integer between 1 and 5");
        }
        const assignedPublished = await db
          .select({ id: lessons.id })
          .from(lessons)
          .innerJoin(clientLessons, eq(clientLessons.lessonId, lessons.id))
          .where(
            and(
              eq(clientLessons.clientId, cid),
              eq(lessons.groupId, groupId),
              eq(lessons.isPublished, true),
            ),
          )
          .limit(1);
        if (assignedPublished.length === 0) {
          throw new Error("Group has no published, assigned lessons for this client");
        }

        // Lookup scopes by client_id so a user reassigned across clients
        // never sees a previous client's rating row leak in as
        // `previousRating`. The current-state row stays in the DB tagged with
        // the old client_id (denormalised at write time); reads from the
        // user's new client side are properly tenant-isolated.
        //
        // Concurrency caveat: two simultaneous upserts from the same user
        // (e.g. duplicate tabs) both read `previousRating` BEFORE either
        // writes, so both `group_rated` events may record the same
        // `previousRating`. The current-state row is still correct
        // (last-write-wins via onConflictDoUpdate); only the audit trail
        // loses one re-rate transition. Acceptable — exact re-rate history
        // is not load-bearing for any reader.
        const [existing] = await db
          .select({ rating: lessonGroupRatings.rating })
          .from(lessonGroupRatings)
          .where(
            and(
              eq(lessonGroupRatings.userId, user.id),
              eq(lessonGroupRatings.groupId, groupId),
              eq(lessonGroupRatings.clientId, cid),
            ),
          )
          .limit(1);
        const previousRating = existing?.rating ?? null;

        await db
          .insert(lessonGroupRatings)
          .values({ userId: user.id, groupId, clientId: cid, rating })
          .onConflictDoUpdate({
            target: [lessonGroupRatings.userId, lessonGroupRatings.groupId],
            set: { rating, updatedAt: new Date() },
          });
        await db
          .insert(lessonEvents)
          .values({
            userId: user.id,
            // event log is keyed by lessonId; pick any published+assigned
            // lesson in the group so the row stays joinable. The lesson
            // could theoretically be unassigned between the SELECT above
            // and this INSERT (admin action mid-rate); the FK to lessons
            // still holds because the lesson row itself is not deleted,
            // and analytics that scope by current client_lessons already
            // ignore events for unassigned lessons.
            lessonId: assignedPublished[0]!.id,
            clientId: cid,
            eventType: "group_rated",
            payload: { groupId, rating, previousRating },
          });

        return { rating, previousRating };
      },

      // Read this user's rating for a single group (or null if unrated).
      // Used by the rating surface to pre-fill / hide the control.
      // Scoped by client_id so a user reassigned across clients can never
      // read a stale rating from their previous client's curriculum (the
      // rating row keeps the original denormalised client_id from when it
      // was written).
      forGroup: async (groupId: string): Promise<number | null> => {
        const [row] = await db
          .select({ rating: lessonGroupRatings.rating })
          .from(lessonGroupRatings)
          .where(
            and(
              eq(lessonGroupRatings.userId, user.id),
              eq(lessonGroupRatings.groupId, groupId),
              eq(lessonGroupRatings.clientId, cid),
            ),
          )
          .limit(1);
        return row?.rating ?? null;
      },

      // Aggregate per-group rating stats for the analytics surfaces. Returns
      // a Map keyed by groupId with avg + count. Scoped by the denormalised
      // client_id column so the query is index-only.
      statsByGroupForClient: async (): Promise<
        Map<string, { avg: number; count: number }>
      > => {
        const rows = await db
          .select({
            groupId: lessonGroupRatings.groupId,
            rating: lessonGroupRatings.rating,
          })
          .from(lessonGroupRatings)
          .where(eq(lessonGroupRatings.clientId, cid));
        const tally = new Map<string, { sum: number; count: number }>();
        for (const r of rows) {
          const t = tally.get(r.groupId) ?? { sum: 0, count: 0 };
          t.sum += r.rating;
          t.count += 1;
          tally.set(r.groupId, t);
        }
        const out = new Map<string, { avg: number; count: number }>();
        for (const [groupId, { sum, count }] of tally) {
          out.set(groupId, {
            avg: Number((sum / count).toFixed(2)),
            count,
          });
        }
        return out;
      },
    },

    groupCompletion: {
      // After writing a lesson_completed event, check whether this user has
      // just finished EVERY published, assigned lesson in that lesson's
      // group. Returns null if the lesson is ungrouped, unpublished, or any
      // assigned+published sibling is still incomplete. The detection is
      // point-in-time and idempotent: re-completing the same lesson keeps
      // returning the same payload (clients use `alreadyRated` to suppress
      // the rating prompt on second view).
      //
      // Reuses the same scoping rules as scopedDb.events.completedLessonIds:
      // only published, currently-assigned lessons count; ungrouped lessons
      // never trigger; orphaned groupId NULL is treated as ungrouped.
      //
      // Behaviour note — CURRENT (not historical) group membership: the
      // detector queries `lessons.group_id` at read time. If an admin
      // moves a lesson between groups after the user completed it, the
      // completion is attributed to the lesson's CURRENT group. This
      // means an admin reshuffling lessons may cause a fresh
      // `groupCompleted` to fire for the destination group when the user
      // completes any remaining sibling. Treated as intended: a regroup
      // by an admin redefines the chapter, and rating the new shape is
      // the right ask. The alternative (snapshotting groupId in the
      // lesson_completed payload at completion time) was rejected as
      // unnecessary complexity for an extremely rare admin action.
      detectForLesson: async (
        lessonId: string,
      ): Promise<{
        groupId: string;
        groupName: string;
        lessonCount: number;
        alreadyRated: boolean;
      } | null> => {
        const [lesson] = await db
          .select({ id: lessons.id, groupId: lessons.groupId })
          .from(lessons)
          .where(eq(lessons.id, lessonId))
          .limit(1);
        if (!lesson || !lesson.groupId) return null;
        const groupId = lesson.groupId;

        const [group] = await db
          .select({ name: lessonGroups.name })
          .from(lessonGroups)
          .where(eq(lessonGroups.id, groupId))
          .limit(1);
        if (!group) return null;

        const assignedPublished = await db
          .select({ id: lessons.id })
          .from(lessons)
          .innerJoin(clientLessons, eq(clientLessons.lessonId, lessons.id))
          .where(
            and(
              eq(clientLessons.clientId, cid),
              eq(lessons.groupId, groupId),
              eq(lessons.isPublished, true),
            ),
          );
        if (assignedPublished.length === 0) return null;
        const targetIds = assignedPublished.map((l) => l.id);

        const completedRows = await db
          .selectDistinct({ lessonId: lessonEvents.lessonId })
          .from(lessonEvents)
          .where(
            and(
              eq(lessonEvents.userId, user.id),
              eq(lessonEvents.eventType, "lesson_completed"),
              inArray(lessonEvents.lessonId, targetIds),
            ),
          );
        if (completedRows.length < targetIds.length) return null;

        const [existingRating] = await db
          .select({ rating: lessonGroupRatings.rating })
          .from(lessonGroupRatings)
          .where(
            and(
              eq(lessonGroupRatings.userId, user.id),
              eq(lessonGroupRatings.groupId, groupId),
            ),
          )
          .limit(1);

        return {
          groupId,
          groupName: group.name,
          lessonCount: targetIds.length,
          alreadyRated: !!existingRating,
        };
      },
    },

    firstThreeComplete: {
      // Fires exactly once — on the completion that takes the user from 2 to 3
      // distinct completed lessons. Returns { totalCompleted: 3 } on that edge,
      // null otherwise.
      //
      // Fires only when THIS lesson is the one that crossed 2 → 3 (same
      // before/after derivation tierCrossing uses), so a later completion at a
      // higher count never re-fires and a completion of a lesson that doesn't
      // count never spuriously fires. Like tierCrossing, the re-completion case
      // is handled upstream — the route only calls this on a genuinely new
      // completion (events.write → alreadyExisted === false); this stays
      // consistent with that gate rather than duplicating it.
      //
      // Scoping mirrors events.completedLessonIds: distinct lesson_completed
      // events for this user over the client's currently-assigned lessons
      // (the just-completed lesson is already persisted when this runs).
      detectForLesson: async (
        lessonId: string,
      ): Promise<{ totalCompleted: number } | null> => {
        const assignments = await db
          .select({ lessonId: clientLessons.lessonId })
          .from(clientLessons)
          .where(eq(clientLessons.clientId, cid));
        const assignedIds = assignments.map((a) => a.lessonId);
        if (assignedIds.length === 0) return null;

        const completedRows = await db
          .selectDistinct({ lessonId: lessonEvents.lessonId })
          .from(lessonEvents)
          .where(
            and(
              eq(lessonEvents.userId, user.id),
              eq(lessonEvents.eventType, "lesson_completed"),
              inArray(lessonEvents.lessonId, assignedIds),
            ),
          );
        const completedAfter = completedRows.length;
        const wasThis = completedRows.some((r) => r.lessonId === lessonId);
        const completedBefore = completedAfter - (wasThis ? 1 : 0);
        return completedAfter === 3 && completedBefore === 2
          ? { totalCompleted: completedAfter }
          : null;
      },
    },

    tierCrossing: {
      // Fires when THIS lesson_completed moved the user up a tier — the tier
      // for their completed-count BEFORE this event differs from the tier
      // AFTER it. Returns the newly-reached tier's { tierId, tierName,
      // tierEmoji }, else null.
      //
      // Denominator is the client's assigned+published lesson count — the same
      // basis as getClientTierRollup / getBrowseTierData — so a user is never
      // classified on a different total than their colleagues. The active
      // ladder comes from getTierConfig(cid) (client override → global →
      // FALLBACK_TIERS), matching every other tier surface.
      //
      // Like firstThreeComplete, this assumes the caller invokes it ONLY on a
      // genuinely new completion (alreadyExisted === false): the "before"
      // count is derived by removing the just-completed lesson from the
      // distinct set, which is the real prior state only when this event
      // actually added it. Re-completions are gated out upstream.
      detectForLesson: async (
        lessonId: string,
      ): Promise<{
        tierId: string;
        tierName: string;
        tierEmoji: string;
        trainingComplete: boolean;
      } | null> => {
        const assignedPublished = await db
          .select({ lessonId: clientLessons.lessonId })
          .from(clientLessons)
          .innerJoin(lessons, eq(lessons.id, clientLessons.lessonId))
          .where(
            and(eq(clientLessons.clientId, cid), eq(lessons.isPublished, true)),
          );
        const assignedPublishedIds = assignedPublished.map((r) => r.lessonId);
        const total = assignedPublishedIds.length;
        if (total === 0) return null;

        const completedRows = await db
          .selectDistinct({ lessonId: lessonEvents.lessonId })
          .from(lessonEvents)
          .where(
            and(
              eq(lessonEvents.userId, user.id),
              eq(lessonEvents.eventType, "lesson_completed"),
              inArray(lessonEvents.lessonId, assignedPublishedIds),
            ),
          );
        const completedSet = new Set(completedRows.map((r) => r.lessonId));
        const completedAfter = completedSet.size;
        // The just-completed lesson only shifts the count if it actually
        // counts toward the tier basis (assigned + published). If it doesn't
        // (e.g. an unpublished lesson), before === after and no cross fires.
        const completedBefore =
          completedAfter - (completedSet.has(lessonId) ? 1 : 0);

        const tiers = await getTierConfig(cid);
        const before = classifyTier(completedBefore, total, tiers);
        const after = classifyTier(completedAfter, total, tiers);
        if (before.tierId === after.tierId) return null;

        const tier = tiers.find((t) => t.id === after.tierId);
        if (!tier) return null;
        return {
          tierId: tier.id,
          tierName: tier.name,
          tierEmoji: tier.emoji,
          trainingComplete: completedAfter === total,
        };
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
      // wins. lesson_engagement always inserts. lesson_upvoted /
      // lesson_unvoted / group_rated are written from their own dedicated
      // scoped helpers, not through this path.
      write: async (
        lessonId: string,
        eventType: LessonEventType,
        payload: Record<string, unknown> | null,
      ): Promise<{ id: string; alreadyExisted: boolean }> => {
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
          if (existing) return { id: existing.id, alreadyExisted: true };
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
        return { id: row!.id, alreadyExisted: false };
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
