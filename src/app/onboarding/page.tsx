import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { scopedDb } from "@/lib/db/scoped";
import OnboardingWizard from "./OnboardingWizard";

export const metadata = { title: "Welcome · Dojo" };
export const dynamic = "force-dynamic";

const STORE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "admin") redirect("/admin");
  if (!session.user.clientId) redirect("/login");

  const needsOnboarding = !session.user.onboardingCompleted;
  const needsReconfirm =
    session.user.onboardingCompleted &&
    (session.user.storeConfirmedAt === null ||
      Date.now() - session.user.storeConfirmedAt > STORE_TTL_MS);
  if (!needsOnboarding && !needsReconfirm) {
    redirect("/");
  }

  const sdb = scopedDb({
    id: session.user.id,
    clientId: session.user.clientId,
    role: "employee",
  });

  const [storeRows, languageRows] = await Promise.all([
    sdb.stores.list(),
    sdb.languages.list(),
  ]);

  const languages =
    languageRows.length > 0 ? languageRows.map((r) => r.language) : ["en"];

  return (
    <main className="relative isolate min-h-dvh overflow-hidden bg-near-black text-white">
      <OnboardingWizard
        stores={storeRows}
        languages={languages}
        initialLanguage={session.user.preferredLanguage}
        initialStoreId={session.user.storeId}
        mode={needsReconfirm ? "reconfirm" : "first"}
      />
    </main>
  );
}
