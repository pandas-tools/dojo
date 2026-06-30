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
            currentTierLabel={currentTier.name}
            nextTierLabel={nextTier?.name}
            lessonsToNext={lessonsToNext}
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
          {data.newRail && (
            <FeaturedRail group={data.newRail} />
          )}
          {data.groups.map((group) => (
            <GroupRail key={group.id ?? "__ungrouped"} group={group} />
          ))}
        </div>
      )}

      <BottomNav userInitial={userInitial} reelsHref={reelsHref} />
    </main>
  );
}

/**
 * FeaturedRail — the FIRST rail ("New lessons"). Wrapped in a glassy
 * bordered card with subtle internal glow blobs per the Figma design.
 */
function FeaturedRail({ group }: { group: BrowseGroup }) {
  return (
    <section className="px-6">
      <div className="relative overflow-hidden rounded-[16px] border border-white/15 bg-[rgba(14,14,14,0.4)] px-4 py-6 backdrop-blur-md">
        {/* Internal glow blobs — match Figma's ellipse decoration */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 -top-20 h-[400px] w-[400px] rounded-full opacity-30"
          style={{
            background:
              "radial-gradient(circle, rgba(193,232,251,0.4) 0%, rgba(193,232,251,0) 60%)",
            filter: "blur(40px)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -right-20 h-[360px] w-[360px] rounded-full opacity-25"
          style={{
            background:
              "radial-gradient(circle, rgba(159,191,207,0.4) 0%, rgba(159,191,207,0) 60%)",
            filter: "blur(40px)",
          }}
        />

        <div className="relative">
          <h2 className="mb-4 text-[20px] font-medium leading-[1.2] tracking-tight text-white">
            {group.name}
          </h2>
          <HorizontalRail group={group} />
        </div>
      </div>
    </section>
  );
}

function GroupRail({ group }: { group: BrowseGroup }) {
  return (
    <section className="px-6">
      <h2 className="mb-4 text-[20px] font-medium leading-[1.2] tracking-tight text-white">
        {group.name}
      </h2>
      <HorizontalRail group={group} />
    </section>
  );
}

function HorizontalRail({ group }: { group: BrowseGroup }) {
  return (
    <div
      className="
        flex gap-4 overflow-x-auto pb-2
        snap-x snap-mandatory
        [scrollbar-width:none] [-ms-overflow-style:none]
        [&::-webkit-scrollbar]:hidden
      "
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
