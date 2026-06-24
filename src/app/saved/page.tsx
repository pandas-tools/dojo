import { redirect } from "next/navigation";
import Link from "next/link";
import { Bookmark, Play } from "lucide-react";
import { auth } from "@/lib/auth";
import { scopedDb } from "@/lib/db/scoped";
import { shapeBrowseData, type BrowseCard } from "@/lib/browse-shape";
import BookmarkButton from "../browse/BookmarkButton";
import BottomNav from "@/components/BottomNav";

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

  // Reuse the same shaping the /browse page consumes so the cards are
  // identical in shape; then flatten and filter to bookmarked.
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
    <main className="min-h-dvh bg-black text-white selection:bg-white/20">
      <header className="px-5 pt-10 pb-6 text-center sm:pt-14">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Saved
        </h1>
        <p className="mt-2 text-sm text-white/55">
          {savedCards.length === 0
            ? "Nothing saved yet"
            : `${savedCards.length} ${savedCards.length === 1 ? "lesson" : "lessons"}`}
        </p>
      </header>

      {savedCards.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="px-5 pb-36 sm:px-8">
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {savedCards.map((card) => (
              <SavedCard key={card.id} card={card} />
            ))}
          </div>
        </div>
      )}

      <BottomNav userInitial={userInitial} reelsHref={reelsHref} />
    </main>
  );
}

function SavedCard({ card }: { card: BrowseCard }) {
  const inner = (
    <>
      <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-zinc-900">
        {card.ready && card.thumbnail ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={card.thumbnail}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-white/30">
            {card.ready ? "No preview" : "Processing"}
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />

        {card.contentType === "video" && card.ready && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 backdrop-blur-md ring-1 ring-white/20 drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]">
              <Play className="h-5 w-5 fill-white text-white translate-x-[1px]" />
            </div>
          </div>
        )}

        {card.completed && (
          <div className="absolute left-3 top-3 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-black">
            Done
          </div>
        )}

        <div className="absolute bottom-1.5 right-1.5">
          <BookmarkButton lessonId={card.id} initialBookmarked={card.isBookmarked} />
        </div>
      </div>

      <h3 className="pt-3 text-sm font-medium text-white line-clamp-2 leading-snug">
        {card.title}
      </h3>
    </>
  );

  return card.ready ? (
    <Link href={`/watch/${card.id}`} className="group block">
      {inner}
    </Link>
  ) : (
    <div className="opacity-60">{inner}</div>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-md px-6 py-20 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
        <Bookmark className="h-5 w-5 text-white/40" />
      </div>
      <p className="mt-4 text-sm text-white/55">
        Tap the bookmark on any lesson to save it here for later.
      </p>
    </div>
  );
}
