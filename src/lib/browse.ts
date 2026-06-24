/**
 * DB orchestration for the employee-facing /browse experience.
 *
 * `getBrowseData(user)` is the single read the page consumes. It fans out the
 * tenant-scoped queries through `scopedDb` (the only sanctioned door to tenant
 * data) and hands the raw rows to `shapeBrowseData` (src/lib/browse-shape.ts),
 * the pure function that does the grouping/ordering. The shape types are
 * re-exported here so consumers can import everything from "@/lib/browse".
 */

import { scopedDb, type ScopedUser } from "@/lib/db/scoped";
import {
  shapeBrowseData,
  selectNewLessonIds,
  NEW_LESSONS_LABEL,
  NEW_LESSONS_GROUP_ID,
  type BrowseData,
  type BrowseGroup,
} from "@/lib/browse-shape";

export type {
  BrowseCard,
  BrowseGroup,
  BrowseData,
} from "@/lib/browse-shape";
export {
  UNGROUPED_LABEL,
  NEW_LESSONS_LABEL,
  NEW_LESSONS_GROUP_ID,
} from "@/lib/browse-shape";

/**
 * The /browse read. One call returns everything the page renders: grouped
 * cards, the client name for the header, and headline totals. All tenant reads
 * go through scopedDb.
 */
export async function getBrowseData(
  user: ScopedUser,
  preferredLanguage: string,
): Promise<BrowseData> {
  const sdb = scopedDb(user);
  const [lessonRows, groupRows, completedIds, bookmarkedIds, client, checkpoint] =
    await Promise.all([
      sdb.lessons.list(),
      sdb.groups.list(),
      sdb.events.completedLessonIds(),
      sdb.bookmarks.forUser(),
      sdb.client.get(),
      sdb.me.getNewLessonsCheckpoint(),
    ]);

  const translationsByLesson = await sdb.translations.forLessons(
    lessonRows.map((l) => l.id),
    preferredLanguage,
  );

  const groups = shapeBrowseData({
    lessons: lessonRows,
    groups: groupRows.map((g) => ({
      id: g.id,
      name: g.name,
      sortOrder: g.sortOrder,
    })),
    translationsByLesson,
    completedIds,
    bookmarkedIds,
  });

  const allCards = groups.flatMap((g) => g.cards);

  // "New lessons" rail. Built from the SAME card objects already in `groups`
  // (a new lesson is never removed from its editorial section), newest-published
  // first, and only when there's at least one. Returned as a separate field so
  // the totals below — and every downstream aggregation over `groups` — keep
  // counting each lesson exactly once.
  const newIds = selectNewLessonIds(lessonRows, checkpoint);
  const cardById = new Map(allCards.map((c) => [c.id, c]));
  const newCards = newIds
    .map((id) => cardById.get(id))
    .filter((c): c is (typeof allCards)[number] => c !== undefined);
  const newRail: BrowseGroup | undefined =
    newCards.length > 0
      ? {
          id: NEW_LESSONS_GROUP_ID,
          name: NEW_LESSONS_LABEL,
          sortOrder: -1,
          cards: newCards,
        }
      : undefined;

  // Bump the high-water mark to now so a returning user only sees a fresh batch
  // once (accepted trade-off). Best-effort: awaited so it lands reliably on
  // serverless (an un-awaited promise can be frozen/killed after the response),
  // but a failure must never break the page — so swallow it.
  try {
    await sdb.me.bumpNewLessonsCheckpoint(new Date());
  } catch {
    // ignore — user simply sees the same rail again next load
  }

  return {
    groups,
    ...(newRail ? { newRail } : {}),
    client: client ? { name: client.name } : null,
    totals: {
      lessons: allCards.length,
      ready: allCards.filter((c) => c.ready).length,
      completed: allCards.filter((c) => c.completed).length,
      bookmarked: allCards.filter((c) => c.isBookmarked).length,
    },
  };
}
