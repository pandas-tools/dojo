import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { scopedDb } from "@/lib/db/scoped";
import type { CarouselSlide } from "@/lib/db/schema";
import BottomNav from "@/components/BottomNav";
import ReelsFeed, { type FeedItem } from "./ReelsFeed";

export const dynamic = "force-dynamic";

export default async function WatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const allLessons = await sdb.lessons.list();
  if (allLessons.length === 0) redirect("/browse");

  const translations = await sdb.translations.forLessons(
    allLessons.map((l) => l.id),
    session.user.preferredLanguage,
  );

  const items: FeedItem[] = [];
  for (const lesson of allLessons) {
    const t = translations.get(lesson.id);
    if (!t) continue;
    if (lesson.contentType === "video" && t.muxPlaybackId) {
      items.push({
        id: lesson.id,
        title: t.title,
        description: t.description,
        content: {
          type: "video",
          playbackId: t.muxPlaybackId,
          aspectRatio: t.aspectRatio,
        },
      });
    } else if (lesson.contentType === "image" && t.imageUrl) {
      items.push({
        id: lesson.id,
        title: t.title,
        description: t.description,
        content: {
          type: "image",
          imageUrl: t.imageUrl,
          imageAlt: t.imageAlt ?? t.title,
          aspectRatio: t.aspectRatio,
        },
      });
    } else if (lesson.contentType === "carousel") {
      const slides = (t.carouselSlides ?? []) as CarouselSlide[];
      if (slides.length >= 2) {
        items.push({
          id: lesson.id,
          title: t.title,
          description: t.description,
          content: { type: "carousel", slides, aspectRatio: t.aspectRatio },
        });
      }
    }
  }

  if (items.length === 0) return <NotReadyBanner />;

  const initialId = items.some((i) => i.id === id) ? id : items[0]!.id;
  const userInitial = (session.user.email ?? "?").charAt(0).toUpperCase();

  return (
    <>
      <ReelsFeed
        items={items}
        initialId={initialId}
        backHref="/browse"
        urlPrefix="/watch/"
      />
      <BottomNav userInitial={userInitial} overlay />
    </>
  );
}

function NotReadyBanner() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="rounded-md border border-amber-200 bg-amber-50 p-6 text-amber-900 max-w-md text-sm">
        <p className="font-medium">No lessons ready yet</p>
        <p className="mt-1">
          The lessons assigned to your client are still processing or missing
          media. Check back in a few minutes.
        </p>
        <Link href="/browse" className="mt-3 inline-block text-amber-900 underline">
          ← Back to lessons
        </Link>
      </div>
    </main>
  );
}
