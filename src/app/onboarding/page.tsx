import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { scopedDb } from "@/lib/db/scoped";
import BrandAtmosphere from "@/components/BrandAtmosphere";
import DojoMark from "@/components/DojoMark";
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
    <main className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-near-black px-6 py-12 text-white">
      <BrandAtmosphere variant="full" showStars showDots animated />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <DojoMark variant="wordmark" className="h-9 w-auto text-white" />
        </div>

        <OnboardingWizard
          stores={storeRows}
          languages={languages}
          initialLanguage={session.user.preferredLanguage}
          initialStoreId={session.user.storeId}
          mode={needsReconfirm ? "reconfirm" : "first"}
        />
      </div>
    </main>
  );
}
