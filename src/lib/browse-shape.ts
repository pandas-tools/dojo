/**
 * Pure shaping logic for the employee-facing /browse experience — no database
 * access, so it can be unit-tested in isolation (src/tests/browse-shape.test.ts).
 * The DB orchestration that feeds it lives in src/lib/browse.ts.
 *
 * The redesigned /browse groups a client's assigned+published lessons into
 * named editorial sections ("Managing the store", "Customer flows", …), each
 * rendered as a horizontal rail of portrait cards with a bookmark toggle.
 */

import type { Lesson, LessonTranslation } from "@/lib/db/schema";

export type BrowseCard = {
  id: string;
  title: string;
  description: string | null;
  contentType: "video" | "image" | "carousel";
  thumbnail: string | null;
  /** Whether the media for this card is fully processed and playable. */
  ready: boolean;
  durationSeconds: number | null;
  /** This user has completed the lesson. */
  completed: boolean;
  /** This user has bookmarked the lesson. */
  isBookmarked: boolean;
  /** Language of the resolved translation (may differ from preferred on EN fallback). */
  language: string | null;
  /** Editorial group the card belongs to; null for the ungrouped bucket. */
  groupId: string | null;
};

export type BrowseGroup = {
  /** Group id, or null for the synthetic "ungrouped" bucket. */
  id: string | null;
  name: string;
  sortOrder: number;
  /** Cards in this section. Grouped sections order by groupSortOrder; the ungrouped bucket by global sortOrder. */
  cards: BrowseCard[];
};

export type BrowseData = {
  /** Non-empty sections only, ordered by group sortOrder; ungrouped bucket last. */
  groups: BrowseGroup[];
  /**
   * Synthetic "New lessons" rail to render ABOVE `groups`, present only when the
   * current user has ≥1 lesson published since their last /browse check. Its
   * cards are duplicates of lessons that also live in `groups` (a "new" lesson
   * is never removed from its editorial section) — so it is intentionally a
   * separate field, NOT an entry in `groups`: keeping it out preserves the
   * invariant that every lesson appears in `groups` exactly once, which the
   * totals / tier-progress / reels aggregations all rely on. Cards are newest-
   * published first. `id` is the NEW_LESSONS_GROUP_ID sentinel.
   */
  newRail?: BrowseGroup;
  client: { name: string } | null;
  totals: {
    lessons: number;
    ready: number;
    completed: number;
    bookmarked: number;
  };
};

/** Label for the synthetic bucket holding lessons not assigned to any group. */
export const UNGROUPED_LABEL = "More lessons";

/** Title of the synthetic "New lessons" rail (exact, surfaced to employees). */
export const NEW_LESSONS_LABEL = "New lessons";
/** Sentinel group id for the synthetic "New lessons" rail. */
export const NEW_LESSONS_GROUP_ID = "__new__";

/**
 * Picks which lessons count as "new" for a user, newest first.
 *
 * A lesson's publish moment is `publishedAt`, falling back to `createdAt` for
 * legacy rows that pre-date the column (the migration backfills these, so the
 * fallback is just belt-and-braces). A lesson is new when that moment is
 * strictly after the user's last check; a NULL threshold means the user has
 * never been checked, so on that first visit every published lesson is new.
 *
 * Pure + DB-free so it's unit-tested in isolation; getBrowseData feeds it the
 * already-scoped (assigned + published) lesson rows and maps the result back to
 * render-ready cards.
 */
export function selectNewLessonIds(
  lessons: { id: string; publishedAt: Date | null; createdAt: Date }[],
  threshold: Date | null,
): string[] {
  const moment = (l: { publishedAt: Date | null; createdAt: Date }) =>
    (l.publishedAt ?? l.createdAt).getTime();
  const t = threshold ? threshold.getTime() : null;
  return lessons
    .filter((l) => t === null || moment(l) > t)
    .sort((a, b) => moment(b) - moment(a))
    .map((l) => l.id);
}

export type GroupInput = { id: string; name: string; sortOrder: number };

/**
 * Buckets lessons into their editorial groups, orders sections by group
 * sortOrder (ungrouped last) and lessons within a section by lesson sortOrder,
 * drops sections with no visible lessons, and projects each lesson into a
 * render-ready card carrying its completed/bookmarked flags. Everything it
 * needs is passed in — no DB access.
 */
export function shapeBrowseData(args: {
  lessons: Lesson[];
  groups: GroupInput[];
  translationsByLesson: Map<string, LessonTranslation>;
  completedIds: Set<string>;
  bookmarkedIds: Set<string>;
}): BrowseGroup[] {
  const { lessons, groups, translationsByLesson, completedIds, bookmarkedIds } =
    args;

  // Defensive: a groupId not matching any known group (e.g. a group deleted
  // between the two reads) falls into the ungrouped bucket so a lesson is
  // never silently dropped from /browse.
  const knownGroupIds = new Set(groups.map((g) => g.id));
  const byGroup = new Map<string | null, Lesson[]>();
  for (const lesson of lessons) {
    const key =
      lesson.groupId && knownGroupIds.has(lesson.groupId)
        ? lesson.groupId
        : null;
    const arr = byGroup.get(key) ?? [];
    arr.push(lesson);
    byGroup.set(key, arr);
  }

  // Grouped lessons order by their per-group position; the ungrouped bucket
  // has no group position, so it keeps the global sortOrder.
  const byGroupOrder = (a: Lesson, b: Lesson) =>
    a.groupSortOrder - b.groupSortOrder ||
    a.createdAt.getTime() - b.createdAt.getTime();
  const byGlobalOrder = (a: Lesson, b: Lesson) =>
    a.sortOrder - b.sortOrder ||
    a.createdAt.getTime() - b.createdAt.getTime();

  const toCard = (lesson: Lesson): BrowseCard => {
    const t = translationsByLesson.get(lesson.id) ?? null;
    // Thumbnail/readiness depend on the lesson's content type:
    //   video    → Mux thumbnail (null until processing finishes)
    //   image    → the image itself
    //   carousel → the first slide; ready once there are ≥2 slides
    let thumbnail: string | null = null;
    let ready = false;
    if (lesson.contentType === "video") {
      thumbnail = t?.thumbnailUrl ?? null;
      ready = !!t?.muxPlaybackId;
    } else if (lesson.contentType === "image") {
      thumbnail = t?.imageUrl ?? null;
      ready = !!t?.imageUrl;
    } else {
      const slides = t?.carouselSlides ?? null;
      thumbnail = slides && slides.length > 0 ? slides[0].url : null;
      ready = !!(slides && slides.length >= 2);
    }
    return {
      id: lesson.id,
      title: t?.title ?? lesson.internalName,
      description: t?.description ?? null,
      contentType: lesson.contentType,
      thumbnail,
      ready,
      durationSeconds: t?.durationSeconds ?? null,
      completed: completedIds.has(lesson.id),
      isBookmarked: bookmarkedIds.has(lesson.id),
      language: t?.language ?? null,
      groupId: lesson.groupId,
    };
  };

  const out: BrowseGroup[] = [];
  for (const g of [...groups].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const ls = (byGroup.get(g.id) ?? []).sort(byGroupOrder);
    if (ls.length === 0) continue;
    out.push({
      id: g.id,
      name: g.name,
      sortOrder: g.sortOrder,
      cards: ls.map(toCard),
    });
  }
  const ungrouped = (byGroup.get(null) ?? []).sort(byGlobalOrder);
  if (ungrouped.length > 0) {
    out.push({
      id: null,
      name: UNGROUPED_LABEL,
      sortOrder: Number.MAX_SAFE_INTEGER,
      cards: ungrouped.map(toCard),
    });
  }
  return out;
}
