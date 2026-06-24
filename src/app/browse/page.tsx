import { redirect } from "next/navigation";
import Link from "next/link";
import { Play } from "lucide-react";
import { auth } from "@/lib/auth";
import {
  getBrowseData,
  type BrowseCard,
  type BrowseGroup,
} from "@/lib/browse";
import { getBrowseTierData } from "@/lib/tiers-data";
import BookmarkButton from "./BookmarkButton";
import TierHeroCard from "./TierHeroCard";
import BottomNav from "@/components/BottomNav";

export const metadata = { title: "Lessons · Dojo" };
export const dynamic = "force-dynamic";

export default async function BrowsePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "admin") redirect("/admin");
  if (!session.user.onboardingCompleted) redirect("/onboarding");
  if (!session.user.clientId) redirect("/login");

  const data = await getBrowseData(
    {
      id: session.user.id,
      clientId: session.user.clientId,
      role: "employee",
    },
    session.user.preferredLanguage,
  );

  const tierData = await getBrowseTierData({
    clientId: session.user.clientId,
    completed: data.totals.completed,
  });

  const groupProgress = data.groups
    .filter((g) => g.cards.length > 0)
    .map((g) => ({
      name: g.name,
      completed: g.cards.filter((c) => c.completed).length,
      total: g.cards.length,
    }));

  const userInitial = (session.user.email ?? "?").charAt(0).toUpperCase();
  const allCards = data.groups.flatMap((g) => g.cards);
  const reelsTarget =
    allCards.find((c) => !c.completed && c.ready) ??
    allCards.find((c) => c.ready) ??
    allCards[0] ??
    null;
  const reelsHref = reelsTarget ? `/watch/${reelsTarget.id}` : undefined;

  return (
    <main className="min-h-dvh bg-black text-white selection:bg-white/20">
      <div className="px-5 pt-8 sm:px-8 sm:pt-10">
        {data.totals.lessons > 0 && (
          <div className="mx-auto max-w-2xl">
            <TierHeroCard
              tierData={tierData}
              userInitial={userInitial}
              groupProgress={groupProgress}
            />
          </div>
        )}
      </div>

      <header className="px-5 pt-8 pb-8 text-center sm:pt-10 sm:pb-10">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Lesson library
        </h1>
      </header>

      {data.totals.lessons === 0 ? (
        <EmptyState />
      ) : (
        <div className="pb-36 space-y-10 sm:space-y-14">
          {data.groups.map((group) => (
            <GroupRail key={group.id ?? "__ungrouped"} group={group} />
          ))}
        </div>
      )}

      <BottomNav userInitial={userInitial} reelsHref={reelsHref} />
    </main>
  );
}

function GroupRail({ group }: { group: BrowseGroup }) {
  return (
    <section>
      <h2 className="px-5 mb-4 text-base font-semibold text-white sm:text-lg sm:mb-5 sm:px-8">
        {group.name}
      </h2>
      <div
        className="
          flex gap-2 overflow-x-auto pb-2
          px-5 sm:px-8 sm:gap-3
          snap-x snap-mandatory
          scroll-pl-5 sm:scroll-pl-8
          [scrollbar-width:none] [-ms-overflow-style:none]
          [&::-webkit-scrollbar]:hidden
        "
      >
        {group.cards.map((card) => (
          <LessonCard key={card.id} card={card} />
        ))}
      </div>
    </section>
  );
}

function LessonCard({ card }: { card: BrowseCard }) {
  const cardShell =
    "snap-start shrink-0 block w-[38vw] max-w-[200px] sm:w-44 md:w-48 lg:w-52";

  const inner = (
    <>
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-zinc-900">
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
          <BookmarkButton
            lessonId={card.id}
            initialBookmarked={card.isBookmarked}
          />
        </div>
      </div>

      <h3 className="pt-3 text-sm font-medium text-white line-clamp-2 leading-snug">
        {card.title}
      </h3>
    </>
  );

  return card.ready ? (
    <Link href={`/watch/${card.id}`} className={`${cardShell} group`}>
      {inner}
    </Link>
  ) : (
    <div className={`${cardShell} opacity-60`}>{inner}</div>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-md px-6 py-20 text-center">
      <p className="text-sm text-white/60">
        No lessons available yet. Check back soon.
      </p>
    </div>
  );
}
