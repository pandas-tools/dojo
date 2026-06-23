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
import { shapeBrowseData, type BrowseData } from "@/lib/browse-shape";

export type {
  BrowseCard,
  BrowseGroup,
  BrowseData,
} from "@/lib/browse-shape";
export { UNGROUPED_LABEL } from "@/lib/browse-shape";

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
  const [lessonRows, groupRows, completedIds, bookmarkedIds, client] =
    await Promise.all([
      sdb.lessons.list(),
      sdb.groups.list(),
      sdb.events.completedLessonIds(),
      sdb.bookmarks.forUser(),
      sdb.client.get(),
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
  return {
    groups,
    client: client ? { name: client.name } : null,
    totals: {
      lessons: allCards.length,
      ready: allCards.filter((c) => c.ready).length,
      completed: allCards.filter((c) => c.completed).length,
      bookmarked: allCards.filter((c) => c.isBookmarked).length,
    },
  };
}
