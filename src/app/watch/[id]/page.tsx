import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { scopedDb } from "@/lib/db/scoped";
import type { CarouselSlide } from "@/lib/db/schema";
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
        notesMarkdown: t.notesMarkdown ?? null,
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
        notesMarkdown: t.notesMarkdown ?? null,
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
          notesMarkdown: t.notesMarkdown ?? null,
          content: { type: "carousel", slides, aspectRatio: t.aspectRatio },
        });
      }
    }
  }

  if (items.length === 0) return <NotReadyBanner />;

  const initialId = items.some((i) => i.id === id) ? id : items[0]!.id;

  return (
    <ReelsFeed
      items={items}
      initialId={initialId}
      backHref="/browse"
      urlPrefix="/watch/"
    />
  );
}

function NotReadyBanner() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-near-black px-6">
      <div className="max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-sm text-white/80">
        <p className="font-medium text-white">No lessons ready yet</p>
        <p className="mt-1">
          The lessons assigned to your client are still processing or missing
          media. Check back in a few minutes.
        </p>
        <Link
          href="/browse"
          className="mt-3 inline-block font-mono text-xs uppercase tracking-wider text-arctic-haze hover:text-arctic-haze/80"
        >
          ← Back to lessons
        </Link>
      </div>
    </main>
  );
}
