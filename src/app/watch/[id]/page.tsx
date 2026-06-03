import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { scopedDb } from "@/lib/db/scoped";
import type { CarouselSlide } from "@/lib/db/schema";
import VideoLessonViewer from "./VideoLessonViewer";
import ImageLessonViewer from "./ImageLessonViewer";
import CarouselLessonViewer from "./CarouselLessonViewer";
import ReelsFeed, { ActiveAware, type FeedItem } from "./ReelsFeed";

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

  // Drop lessons whose translation/media isn't ready — same content-type-aware
  // readiness check the standalone /watch page used.
  const ready = allLessons.filter((l) => {
    const t = translations.get(l.id);
    if (!t) return false;
    if (l.contentType === "video") return !!t.muxPlaybackId;
    if (l.contentType === "image") return !!t.imageUrl;
    if (l.contentType === "carousel") {
      const slides = (t.carouselSlides ?? []) as CarouselSlide[];
      return slides.length >= 2;
    }
    return false;
  });

  if (ready.length === 0) {
    return <NotReadyBanner />;
  }

  // Honor the requested lesson id when ready; otherwise land on the first
  // ready lesson and let the user scroll through.
  const initialId = ready.some((l) => l.id === id) ? id : ready[0]!.id;

  const items: FeedItem[] = ready.map((lesson) => {
    const t = translations.get(lesson.id)!;
    return {
      id: lesson.id,
      title: t.title,
      description: t.description,
      node: (
        <ActiveAware>
          {(active) => {
            if (lesson.contentType === "video" && t.muxPlaybackId) {
              return (
                <VideoLessonViewer
                  lessonId={lesson.id}
                  playbackId={t.muxPlaybackId}
                  title={t.title}
                  subtitlesEnabled
                  aspectRatio={t.aspectRatio}
                  active={active}
                />
              );
            }
            if (lesson.contentType === "image" && t.imageUrl) {
              return (
                <ImageLessonViewer
                  lessonId={lesson.id}
                  imageUrl={t.imageUrl}
                  imageAlt={t.imageAlt ?? t.title}
                  aspectRatio={t.aspectRatio}
                  active={active}
                />
              );
            }
            if (lesson.contentType === "carousel" && t.carouselSlides) {
              return (
                <CarouselLessonViewer
                  lessonId={lesson.id}
                  slides={t.carouselSlides as CarouselSlide[]}
                  aspectRatio={t.aspectRatio}
                  active={active}
                />
              );
            }
            return null;
          }}
        </ActiveAware>
      ),
    };
  });

  return (
    <ReelsFeed
      items={items}
      initialId={initialId}
      backHref="/browse"
      buildHref={(lessonId) => `/watch/${lessonId}`}
    />
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
