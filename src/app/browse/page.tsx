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
      <div
        className="relative overflow-hidden rounded-[16px] border border-white/40 px-4 py-6"
        style={{
          // Layered: subtle frosted-fjord wash + arctic-haze radial highlight +
          // dark base. Produces the 'distinct colored section' the Figma uses
          // to set this rail apart from the unwrapped rails below.
          backgroundImage:
            "radial-gradient(120% 100% at 20% 0%, rgba(193,232,251,0.18) 0%, rgba(193,232,251,0) 55%), radial-gradient(100% 100% at 90% 100%, rgba(159,191,207,0.22) 0%, rgba(159,191,207,0) 60%), linear-gradient(180deg, rgba(68,81,88,0.35) 0%, rgba(14,14,14,0.5) 100%)",
        }}
      >
        {/* Large soft-cyan accent blob top-left — matches Figma's Ellipse 102 */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-40 -top-32 h-[520px] w-[520px] rounded-full opacity-55"
          style={{
            background:
              "radial-gradient(circle, rgba(193,232,251,0.5) 0%, rgba(193,232,251,0) 65%)",
            filter: "blur(50px)",
          }}
        />
        {/* Second accent blob bottom-right — matches Figma's Ellipse 103 */}
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -right-32 h-[460px] w-[460px] rounded-full opacity-50"
          style={{
            background:
              "radial-gradient(circle, rgba(159,191,207,0.55) 0%, rgba(159,191,207,0) 60%)",
            filter: "blur(50px)",
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
