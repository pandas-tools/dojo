import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getBrowseData,
  type BrowseGroup,
} from "@/lib/browse";
import { getBrowseTierData } from "@/lib/tiers-data";
import BottomNav from "@/components/BottomNav";
import LibraryAtmosphere from "@/components/LibraryAtmosphere";
import TierStrip from "@/components/TierStrip";
import { LessonCardLink } from "@/components/LessonCard";
import { cn } from "@/lib/cn";

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

  // Compute next-tier hint for the TierStrip
  const currentTier = tierData.tiers.find((t) => t.id === tierData.me.tierId);
  const currentIdx = tierData.tiers.findIndex((t) => t.id === tierData.me.tierId);
  const nextTier =
    currentIdx >= 0 ? (tierData.tiers[currentIdx + 1] ?? null) : null;
  const lessonsToNext = nextTier
    ? Math.max(0, Math.ceil(nextTier.minPct * tierData.me.total) - tierData.me.completed)
    : undefined;

  const userInitial = (session.user.email ?? "?").charAt(0).toUpperCase();
  const allCards = data.groups.flatMap((g) => g.cards);
  const reelsTarget =
    allCards.find((c) => !c.completed && c.ready) ??
    allCards.find((c) => c.ready) ??
    allCards[0] ??
    null;
  const reelsHref = reelsTarget ? `/watch/${reelsTarget.id}` : undefined;

  return (
    <main className="relative isolate min-h-dvh overflow-hidden bg-near-black text-white selection:bg-arctic-haze/30">
      <LibraryAtmosphere />

      <div className="relative z-10 px-6 pt-4">
        {currentTier && (
          <TierStrip
            currentTier={{
              id: currentTier.id,
              name: currentTier.name,
              sortOrder: currentTier.sortOrder,
            }}
            nextTierLabel={nextTier?.name}
            lessonsToNext={lessonsToNext}
            tiers={tierData.tiers.map((t) => ({
              id: t.id,
              name: t.name,
              sortOrder: t.sortOrder,
            }))}
            completed={tierData.me.completed}
            total={tierData.me.total}
          />
        )}
      </div>

      <header className="relative z-10 mx-auto mt-12 max-w-[320px] px-6 text-center">
        <h1 className="text-[24px] font-medium leading-[1.2] tracking-tight text-[#f9fdff]">
          Lesson library
        </h1>
        <p className="mt-2 text-[14px] font-medium leading-[22px] tracking-[0.07px] text-[#f9fdff]/85">
          Browse lessons assigned to your store, save the ones you want to revisit.
        </p>
      </header>

      {data.totals.lessons === 0 ? (
        <EmptyState />
      ) : (
        <div className="relative z-10 mt-10 space-y-8 pb-36">
          {(() => {
            // The Figma always shows a featured/highlighted section at the
            // top. Real `newRail` data is one-shot per fresh batch (checkpoint
            // bumps on every load), so fall back to the first regular group
            // styled the same way — keeps the layout consistent for any user.
            const featured = data.newRail ?? data.groups[0];
            const remainingGroups = data.newRail
              ? data.groups
              : data.groups.slice(1);
            return (
              <>
                {featured && <FeaturedRail group={featured} />}
                {remainingGroups.map((group) => (
                  <GroupRail key={group.id ?? "__ungrouped"} group={group} />
                ))}
              </>
            );
          })()}
        </div>
      )}

      <BottomNav userInitial={userInitial} reelsHref={reelsHref} />
    </main>
  );
}

/**
 * FeaturedRail — the FIRST rail ("New lessons"). Differentiated from regular
 * groups by a gradient title (arctic-haze → steel-harbor) and a hairline
 * divider beneath. No bordered frame or glow — composition does the work.
 */
function FeaturedRail({ group }: { group: BrowseGroup }) {
  return (
    <section>
      <h2 className="mb-4 inline-block w-fit px-6 text-[20px] font-medium leading-[1.2] tracking-tight whitespace-nowrap bg-gradient-to-r from-arctic-haze to-steel-harbor bg-clip-text text-transparent">
        {group.name}
      </h2>
      <HorizontalRail group={group} edgeToEdge />
      <div aria-hidden className="mx-6 mt-8 h-px bg-white/10" />
    </section>
  );
}

function GroupRail({ group }: { group: BrowseGroup }) {
  return (
    <section>
      <h2 className="mb-4 px-6 text-[20px] font-medium leading-[1.2] tracking-tight text-white">
        {group.name}
      </h2>
      <HorizontalRail group={group} edgeToEdge />
    </section>
  );
}

/**
 * HorizontalRail — horizontal scroll. When `edgeToEdge` is true (default for
 * standalone rails), the rail starts with pl-6 to align the first card with
 * the section header padding and flows past the right edge with just a small
 * pr-2 hint. When false, no padding — the parent (e.g. FeaturedRail's
 * bordered card) controls the alignment.
 */
function HorizontalRail({
  group,
  edgeToEdge = false,
}: {
  group: BrowseGroup;
  edgeToEdge?: boolean;
}) {
  return (
    <div
      className={cn(
        // snap-proximity (not mandatory) so the first card stays at its pl-6
        // resting position on mount and only snaps as the user scrolls past a
        // card's midpoint. scroll-pl-6 keeps that 24px gutter as the snap
        // origin once snapping does kick in.
        "flex gap-4 overflow-x-auto pb-2 snap-x snap-proximity [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
        edgeToEdge && "pl-6 pr-2 scroll-pl-6",
      )}
    >
      {group.cards.map((card) => (
        <LessonCardLink key={card.id} card={card} />
      ))}
    </div>
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
