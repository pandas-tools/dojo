import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { scopedDb } from "@/lib/db/scoped";

export const dynamic = "force-dynamic";

const STORE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Root entry. Resolves where to send the caller after auth based on the
// unified experience model: employees go straight to Reels at the first
// lesson they haven't completed yet — same path on first login or tenth
// login. Admins go to /admin. Unauthenticated → /login.
export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (session.user.role === "admin") redirect("/admin");

  // Belt-and-braces: middleware also enforces these gates, but the page
  // can hit a stale JWT race on the very first request after sign-in.
  if (!session.user.onboardingCompleted) redirect("/onboarding");
  const storeExpired =
    session.user.storeConfirmedAt === null ||
    Date.now() - session.user.storeConfirmedAt > STORE_TTL_MS;
  if (storeExpired) redirect("/onboarding");

  if (!session.user.clientId) redirect("/login");

  // Compute the first incomplete lesson by sort_order for this user.
  // Falls back to /browse if there are no lessons assigned yet, or loops
  // back to the first lesson if everything's already completed.
  const sdb = scopedDb({
    id: session.user.id,
    clientId: session.user.clientId,
    role: "employee",
  });
  const [lessons, completions] = await Promise.all([
    sdb.lessons.list(),
    sdb.completions.forUser(),
  ]);
  if (lessons.length === 0) redirect("/browse");

  const completedIds = new Set(completions.map((c) => c.lessonId));
  const firstIncomplete = lessons.find((l) => !completedIds.has(l.id));
  const target = firstIncomplete ?? lessons[0];
  redirect(`/watch/${target.id}`);
}
