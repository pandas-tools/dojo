import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { scopedDb } from "@/lib/db/scoped";
import type { CarouselSlide } from "@/lib/db/schema";
import VideoLessonViewer from "./VideoLessonViewer";
import ImageLessonViewer from "./ImageLessonViewer";
import CarouselLessonViewer from "./CarouselLessonViewer";
import ReelsShell from "./ReelsShell";

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

  const lesson = await sdb.lessons.getById(id);
  if (!lesson) notFound();

  const translation = await sdb.translations.forLesson(
    id,
    session.user.preferredLanguage,
  );
  if (!translation) notFound();

  // Content-type-aware readiness — render the gentle "not ready" surface
  // if the translation is missing its media. The fallback resolution upstream
  // already prefers EN whenever the user's language is media-incomplete, so
  // this trips only when EN itself isn't ready.
  const notReady = (() => {
    if (lesson.contentType === "video" && !translation.muxPlaybackId) {
      return {
        title: "Video still processing",
        detail: "This lesson's video isn't ready yet. Try again in a few minutes.",
      };
    }
    if (lesson.contentType === "image" && !translation.imageUrl) {
      return {
        title: "Image missing",
        detail: "This image lesson hasn't been set up yet.",
      };
    }
    if (lesson.contentType === "carousel") {
      const slides = (translation.carouselSlides ?? []) as CarouselSlide[];
      if (slides.length < 2) {
        return {
          title: "Carousel incomplete",
          detail: "This carousel lesson needs at least 2 slides.",
        };
      }
    }
    return null;
  })();

  if (notReady) return <NotReadyBanner {...notReady} />;

  return (
    <ReelsShell
      backHref="/browse"
      title={translation.title}
      description={translation.description}
    >
      {lesson.contentType === "video" && translation.muxPlaybackId && (
        <VideoLessonViewer
          lessonId={id}
          playbackId={translation.muxPlaybackId}
          title={translation.title}
          subtitlesEnabled
          aspectRatio={translation.aspectRatio}
        />
      )}
      {lesson.contentType === "image" && translation.imageUrl && (
        <ImageLessonViewer
          lessonId={id}
          imageUrl={translation.imageUrl}
          imageAlt={translation.imageAlt ?? translation.title}
          aspectRatio={translation.aspectRatio}
        />
      )}
      {lesson.contentType === "carousel" && translation.carouselSlides && (
        <CarouselLessonViewer
          lessonId={id}
          slides={translation.carouselSlides as CarouselSlide[]}
          aspectRatio={translation.aspectRatio}
        />
      )}
    </ReelsShell>
  );
}

function NotReadyBanner({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="rounded-md border border-amber-200 bg-amber-50 p-6 text-amber-900 max-w-md text-sm">
        <p className="font-medium">{title}</p>
        <p className="mt-1">{detail}</p>
        <Link
          href="/browse"
          className="mt-3 inline-block text-amber-900 underline"
        >
          ← Back to lessons
        </Link>
      </div>
    </main>
  );
}
