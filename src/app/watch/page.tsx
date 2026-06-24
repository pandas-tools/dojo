import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { scopedDb } from "@/lib/db/scoped";

export const dynamic = "force-dynamic";

export default async function WatchEntryPage() {
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

  if (lessons.length === 0) redirect("/browse");

  const firstIncomplete = lessons.find((l) => !completedIds.has(l.id)) ?? lessons[0];

  redirect(`/watch/${firstIncomplete.id}`);
}
