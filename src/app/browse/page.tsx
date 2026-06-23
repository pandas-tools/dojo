import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getBrowseData, type BrowseGroup } from "@/lib/browse";
import { signOutAction } from "../actions";
import BookmarkButton from "./BookmarkButton";

export const metadata = { title: "Lessons · Dojo" };
export const dynamic = "force-dynamic";

// NOTE: this is the functional, light-theme consumer of the grouped /browse
// read shape (groups[] → cards[], each card carrying isBookmarked). The dark,
// Reels-style rail redesign is built on top of this same `getBrowseData`
// contract — see src/lib/browse.ts for the shape.
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

  return (
    <main className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Dojo</h1>
            <p className="text-xs text-zinc-500">
              {data.client?.name ?? "Your client"} · {session.user.email}
            </p>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-sm text-zinc-600 hover:text-zinc-900"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        {data.totals.lessons === 0 ? (
          <>
            <h2 className="text-xl font-semibold mb-2">Training lessons</h2>
            <p className="text-sm text-zinc-600">
              No lessons available yet. Check back soon.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-zinc-600 mb-8">
              {data.totals.ready} ready · {data.totals.completed} completed ·{" "}
              {data.totals.bookmarked} saved
            </p>
            <div className="space-y-10">
              {data.groups.map((group) => (
                <GroupRail
                  key={group.id ?? "__ungrouped"}
                  group={group}
                  preferredLanguage={session.user.preferredLanguage}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function GroupRail({
  group,
  preferredLanguage,
}: {
  group: BrowseGroup;
  preferredLanguage: string;
}) {
  return (
    <div>
      <h2 className="text-base font-semibold text-zinc-900 mb-3">
        {group.name}
      </h2>
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
        {group.cards.map((card) => {
          const inner = (
            <>
              <div className="aspect-[4/5] bg-zinc-100 relative">
                {card.ready && card.thumbnail ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={card.thumbnail}
                    alt={card.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-400 text-xs">
                    {card.ready ? "No preview" : "Processing…"}
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <BookmarkButton
                    lessonId={card.id}
                    initialBookmarked={card.isBookmarked}
                  />
                </div>
                {card.completed && (
                  <div className="absolute top-2 left-2 rounded-full bg-emerald-600 text-white text-xs px-2 py-1">
                    ✓ Done
                  </div>
                )}
              </div>
              <div className="p-3">
                <h3 className="text-sm font-medium text-zinc-900 line-clamp-2">
                  {card.title}
                </h3>
                <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                  {card.durationSeconds && (
                    <span>
                      {card.durationSeconds < 60
                        ? `${card.durationSeconds}s`
                        : `${Math.ceil(card.durationSeconds / 60)} min`}
                    </span>
                  )}
                  {card.language && card.language !== preferredLanguage && (
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 uppercase">
                      {card.language}
                    </span>
                  )}
                </div>
              </div>
            </>
          );

          const cardClass =
            "group block w-44 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-white";

          return card.ready ? (
            <Link
              key={card.id}
              href={`/watch/${card.id}`}
              className={`${cardClass} hover:shadow-md transition-shadow`}
            >
              {inner}
            </Link>
          ) : (
            <div key={card.id} className={`${cardClass} opacity-70`}>
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
