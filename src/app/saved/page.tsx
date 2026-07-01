import { redirect } from "next/navigation";
import { Bookmark } from "lucide-react";
import { auth } from "@/lib/auth";
import { scopedDb } from "@/lib/db/scoped";
import { shapeBrowseData } from "@/lib/browse-shape";
import BottomNav from "@/components/BottomNav";
import LibraryAtmosphere from "@/components/LibraryAtmosphere";
import { LessonCardLink } from "@/components/LessonCard";

export const metadata = { title: "Saved · Dojo" };
export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "admin") redirect("/admin");
  if (!session.user.onboardingCompleted) redirect("/onboarding");
  if (!session.user.clientId) redirect("/login");

  const sdb = scopedDb({
    id: session.user.id,
    clientId: session.user.clientId,
    role: "employee",
  });

  const [lessons, groupRows, completedIds, bookmarkedIds] = await Promise.all([
    sdb.lessons.list(),
    sdb.groups.list(),
    sdb.events.completedLessonIds(),
    sdb.bookmarks.forUser(),
  ]);

  const translations = await sdb.translations.forLessons(
    lessons.map((l) => l.id),
    session.user.preferredLanguage,
  );

  const groups = shapeBrowseData({
    lessons,
    groups: groupRows.map((g) => ({
      id: g.id,
      name: g.name,
      sortOrder: g.sortOrder,
    })),
    translationsByLesson: translations,
    completedIds,
    bookmarkedIds,
  });
  const savedCards = groups
    .flatMap((g) => g.cards)
    .filter((c) => c.isBookmarked);

  const userInitial = (session.user.email ?? "?").charAt(0).toUpperCase();
  const allCards = groups.flatMap((g) => g.cards);
  const reelsTarget =
    allCards.find((c) => !c.completed && c.ready) ??
    allCards.find((c) => c.ready) ??
    allCards[0] ??
    null;
  const reelsHref = reelsTarget ? `/watch/${reelsTarget.id}` : undefined;

  return (
    <main className="relative isolate min-h-dvh overflow-hidden bg-near-black text-white selection:bg-arctic-haze/30">
      <LibraryAtmosphere />

      <header className="relative z-10 mx-auto mt-[98px] px-6 text-center lg:mt-[114px] lg:max-w-[560px]">
        <h1 className="text-[24px] font-medium leading-[1.2] tracking-tight text-[#f9fdff] lg:text-[36px]">
          Bookmarks
        </h1>
        <p className="mt-2 text-[14px] font-medium leading-[22px] tracking-[0.07px] text-[#f9fdff]/85 lg:mt-3 lg:text-[16px] lg:leading-[26px]">
          {savedCards.length === 0
            ? "Tap the bookmark on any lesson to save it here."
            : `${savedCards.length} saved ${savedCards.length === 1 ? "lesson" : "lessons"}`}
        </p>
      </header>

      {savedCards.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="relative z-10 mt-10 pb-36">
          <div className="mx-auto flex max-w-[378px] flex-wrap content-start gap-x-4 gap-y-6 px-6 lg:max-w-[608px]">
            {savedCards.map((card) => (
              <LessonCardLink key={card.id} card={card} />
            ))}
          </div>
        </div>
      )}

      <BottomNav userInitial={userInitial} reelsHref={reelsHref} />
    </main>
  );
}

function EmptyState() {
  return (
    <div className="relative z-10 mx-auto mt-20 max-w-md px-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
        <Bookmark className="h-5 w-5 text-white/40" />
      </div>
      <p className="mt-4 text-sm text-white/55">
        Tap the bookmark on any lesson to save it here for later.
      </p>
    </div>
  );
}
