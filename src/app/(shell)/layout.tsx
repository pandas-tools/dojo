import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { scopedDb } from "@/lib/db/scoped";
import BottomNav from "@/components/BottomNav";

export const dynamic = "force-dynamic";

/**
 * Persistent shell for the employee-facing surfaces (library, saved, profile).
 * Keeps BottomNav mounted across navigations so the sliding-pill layoutId
 * animation can glide between tabs instead of resetting on every route change.
 * /watch/[id] intentionally sits outside this shell — the reels player owns
 * its own full-viewport chrome.
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
    <>
      {children}
      <BottomNav reelsHref={reelsHref} />
    </>
  );
}
