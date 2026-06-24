import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { scopedDb } from "@/lib/db/scoped";
import DojoMark from "@/components/DojoMark";
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
    <main className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-near-black px-6 py-16 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-brand-gradient-dark opacity-50"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_20%_-10%,rgba(193,232,251,0.18),transparent_55%)]"
      />

      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <DojoMark variant="wordmark" className="mx-auto h-10 w-auto text-white" />
          <h1 className="mt-6 text-2xl font-medium tracking-tight sm:text-3xl">
            {needsReconfirm ? "Quick check-in" : "Welcome to Dojo"}
          </h1>
          <p className="mt-2 text-sm text-white/65">
            {needsReconfirm
              ? "Just confirming you're still in the right store. Update if it's changed."
              : "A quick onboarding so we can tailor your training experience."}
          </p>
        </div>
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
