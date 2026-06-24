import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { scopedDb } from "@/lib/db/scoped";
import BrandAtmosphere from "@/components/BrandAtmosphere";
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
      <BrandAtmosphere variant="full" showStars showDots />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <DojoMark variant="wordmark" className="h-10 w-auto text-white" />
          <h1 className="mt-6 text-2xl font-medium tracking-tight sm:text-3xl">
            {needsReconfirm ? "Quick check-in" : (
              <>
                Welcome to <span className="text-arctic-haze">Dojo</span>
              </>
            )}
          </h1>
          <p className="mt-2 max-w-xs text-sm text-white/65">
            {needsReconfirm
              ? "Just confirming you're still in the right store. Update if it's changed."
              : "A quick onboarding so we can tailor your training experience."}
          </p>
        </div>

        <div className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-6 -top-8 h-24 bg-[radial-gradient(60%_100%_at_50%_100%,rgba(193,232,251,0.22),transparent_70%)]"
          />
          <div className="relative rounded-3xl border border-white/12 bg-white/[0.03] p-6 backdrop-blur-2xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] sm:p-7">
            <OnboardingForm
              stores={storeRows}
              languages={languages}
              initialLanguage={session.user.preferredLanguage}
              initialStoreId={session.user.storeId}
              mode={needsReconfirm ? "reconfirm" : "first"}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
