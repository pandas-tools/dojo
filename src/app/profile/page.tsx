import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { scopedDb } from "@/lib/db/scoped";
import BottomNav from "@/components/BottomNav";
import ProfileForm from "./ProfileForm";

export const metadata = { title: "Profile · Dojo" };
export const dynamic = "force-dynamic";

// Friendly labels for the language picker. Mirrors the small set we
// already support in Mux auto-captions (see spec §8) — extend here
// as new languages get added to client_languages.
const LANG_LABELS: Record<string, string> = {
  en: "English",
  fr: "Français",
  de: "Deutsch",
  es: "Español",
  it: "Italiano",
  pt: "Português",
  nl: "Nederlands",
  pl: "Polski",
};

export default async function ProfilePage() {
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

  const [langs, storeRows] = await Promise.all([
    sdb.languages.list(),
    sdb.stores.list(),
  ]);

  const languages = langs.map((l) => ({
    language: l.language,
    label: LANG_LABELS[l.language] ?? l.language.toUpperCase(),
  }));
  const sortedStores = [...storeRows].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const userInitial = (session.user.email ?? "?").charAt(0).toUpperCase();

  return (
    <main className="min-h-dvh bg-black text-white selection:bg-white/20">
      <header className="px-5 pt-10 pb-8 text-center sm:pt-14">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white text-2xl font-semibold text-black">
          {userInitial}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Profile
        </h1>
      </header>

      <div className="mx-auto max-w-md px-5 pb-36">
        <ProfileForm
          email={session.user.email ?? ""}
          initialLanguage={session.user.preferredLanguage}
          initialStoreId={session.user.storeId ?? null}
          languages={languages}
          stores={sortedStores.map((s) => ({
            id: s.id,
            name: s.name,
            city: s.city,
          }))}
        />
      </div>

      <BottomNav userInitial={userInitial} />
    </main>
  );
}
