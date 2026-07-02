import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { scopedDb } from "@/lib/db/scoped";
import OnboardingWizard from "./OnboardingWizard";

export const metadata = { title: "Welcome · Dojo" };
export const dynamic = "force-dynamic";

const STORE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// TEMP — see the mapping below. Hash the store id into a stable, plausible
// Belgian street address so every store shows a distinct second line.
const PLACEHOLDER_STREETS = [
  "Rue de la Loi",
  "Meir",
  "Avenue Louise",
  "Veldstraat",
  "Boulevard Anspach",
  "Grote Markt",
  "Rue Neuve",
  "Korenmarkt",
  "Place Verte",
  "Bondgenotenlaan",
];

function placeholderAddress(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const street = PLACEHOLDER_STREETS[h % PLACEHOLDER_STREETS.length]!;
  const number = (h % 140) + 1;
  return `${street} ${number}`;
}

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

  // TEMP: deterministic placeholder addresses until the stores schema grows
  // a real `address` column (delegated to Dex, topic dojo-stores-address-column).
  // Delete this mapping + placeholderAddress() when the column lands.
  const stores = storeRows.map((s) => ({
    ...s,
    address: placeholderAddress(s.id),
  }));

  const languages =
    languageRows.length > 0 ? languageRows.map((r) => r.language) : ["en"];

  return (
    <main className="relative isolate min-h-dvh overflow-hidden bg-near-black text-white">
      <OnboardingWizard
        stores={stores}
        languages={languages}
        initialLanguage={session.user.preferredLanguage}
        initialStoreId={session.user.storeId}
        mode={needsReconfirm ? "reconfirm" : "first"}
      />
    </main>
  );
}
