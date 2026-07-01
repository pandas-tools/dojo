import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { scopedDb } from "@/lib/db/scoped";
import BottomNav from "@/components/BottomNav";
import ShellFade from "./ShellFade";

export const dynamic = "force-dynamic";

/**
 * Persistent shell for the employee-facing surfaces (library, saved, profile).
 * Keeps BottomNav mounted across navigations so its active-tab pill can
 * spring-glide between icons rather than snapping on remount. ShellFade
 * wraps `children` in a CSS keyframe fade-in so each new page mounts
 * already-invisible and eases in without a doubled-render flash.
 * /watch/[id] intentionally sits outside this shell — the reels player
 * owns its own full-viewport chrome.
 */
export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  const [lessons, completedIds] = await Promise.all([
    sdb.lessons.list(),
    sdb.events.completedLessonIds(),
  ]);
  const firstIncomplete =
    lessons.find((l) => !completedIds.has(l.id)) ?? lessons[0];
  const reelsHref = firstIncomplete ? `/watch/${firstIncomplete.id}` : undefined;

  return (
    <div className="min-h-dvh bg-near-black">
      <ShellFade>{children}</ShellFade>
      <BottomNav reelsHref={reelsHref} />
    </div>
  );
}
