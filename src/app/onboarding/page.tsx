import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { scopedDb } from "@/lib/db/scoped";
import OnboardingForm from "./OnboardingForm";

export const metadata = { title: "Welcome · Dojo" };
export const dynamic = "force-dynamic";

const STORE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "admin") redirect("/admin");
  if (!session.user.clientId) redirect("/login");

  // The 30-day re-confirmation gate uses the same page. We render the
  // form when the user either hasn't onboarded yet, or has but their
  // last store confirmation is older than the TTL (or never set).
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

  // Language picker: prefer the client's configured languages; fall back
  // to English-only if nothing is configured yet (every lesson is
  // guaranteed to have an English translation).
  const languages =
    languageRows.length > 0
      ? languageRows.map((r) => r.language)
      : ["en"];

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-16">
      <div className="w-full max-w-md rounded-md border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold mb-2">
          {needsReconfirm ? "Quick check-in" : "Welcome to Dojo"}
        </h1>
        <p className="text-sm text-zinc-600 mb-6">
          {needsReconfirm
            ? "Just confirming you're still in the right store. Update if it's changed."
            : "A quick onboarding so we can tailor your training experience."}
        </p>
        <OnboardingForm
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
