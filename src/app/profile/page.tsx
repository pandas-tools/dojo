import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { scopedDb } from "@/lib/db/scoped";
import BottomNav from "@/components/BottomNav";
import DojoMark from "@/components/DojoMark";
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

  const [langs, storeRows, lessons, completedIds] = await Promise.all([
    sdb.languages.list(),
    sdb.stores.list(),
    sdb.lessons.list(),
    sdb.events.completedLessonIds(),
  ]);

  const firstIncomplete =
    lessons.find((l) => !completedIds.has(l.id)) ?? lessons[0];
  const reelsHref = firstIncomplete ? `/watch/${firstIncomplete.id}` : undefined;

  const languages = langs.map((l) => ({
    language: l.language,
    label: LANG_LABELS[l.language] ?? l.language.toUpperCase(),
  }));
  const sortedStores = [...storeRows].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const userInitial = (session.user.email ?? "?").charAt(0).toUpperCase();

  return (
    <main className="min-h-dvh bg-near-black text-white selection:bg-arctic-haze/30">
      <header className="flex items-center justify-between px-5 pt-6 sm:px-8 sm:pt-7">
        <Link
          href="/browse"
          aria-label="Dojo home"
          className="text-white transition-opacity hover:opacity-80"
        >
          <DojoMark variant="wordmark" className="h-7 w-auto sm:h-8" />
        </Link>
      </header>
      <div className="px-5 pt-10 pb-8 text-center sm:pt-12">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-arctic-haze text-2xl font-medium text-near-black">
          {userInitial}
        </div>
        <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
          Profile
        </h1>
      </div>

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

      <BottomNav userInitial={userInitial} reelsHref={reelsHref} />
    </main>
  );
}
