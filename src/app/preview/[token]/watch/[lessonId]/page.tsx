import { notFound } from "next/navigation";
import Link from "next/link";
import { verifyPreviewToken } from "@/lib/preview-tokens";
import { loadPreviewWatch, loadPreviewBrowse } from "@/lib/preview-data";
import type { CarouselSlide } from "@/lib/db/schema";
import VideoLessonViewer from "@/app/watch/[id]/VideoLessonViewer";
import ImageLessonViewer from "@/app/watch/[id]/ImageLessonViewer";
import CarouselLessonViewer from "@/app/watch/[id]/CarouselLessonViewer";
import ReelsShell from "@/app/watch/[id]/ReelsShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Preview lesson · Dojo" };

export default async function PreviewWatchPage({
  params,
}: {
  params: Promise<{ token: string; lessonId: string }>;
}) {
  const { token, lessonId } = await params;
  const payload = verifyPreviewToken(token);
  if (!payload) notFound();

  const [data, browse] = await Promise.all([
    loadPreviewWatch(payload.clientId, lessonId),
    loadPreviewBrowse(payload.clientId),
  ]);
  if (!data) notFound();
  const { header, lesson, translation } = data;

  const ordered = browse?.lessons ?? [];
  const idx = ordered.findIndex((l) => l.lessonId === lessonId);
  const prevHref =
    ordered.length > 1 && idx >= 0
      ? `/preview/${token}/watch/${ordered[(idx - 1 + ordered.length) % ordered.length]!.lessonId}`
      : null;
  const nextHref =
    ordered.length > 1 && idx >= 0
      ? `/preview/${token}/watch/${ordered[(idx + 1) % ordered.length]!.lessonId}`
      : null;

  return (
    <>
      <ReelsShell
        backHref={`/preview/${token}/browse`}
        title={translation.title}
        description={translation.description}
        prevHref={prevHref}
        nextHref={nextHref}
      >
        {lesson.contentType === "video" && translation.muxPlaybackId && (
          <VideoLessonViewer
            lessonId={lesson.id}
            playbackId={translation.muxPlaybackId}
            title={translation.title}
            subtitlesEnabled
            disableTracking
            aspectRatio={translation.aspectRatio}
          />
        )}
        {lesson.contentType === "image" && translation.imageUrl && (
          <ImageLessonViewer
            lessonId={lesson.id}
            imageUrl={translation.imageUrl}
            imageAlt={translation.imageAlt ?? translation.title}
            disableTracking
            aspectRatio={translation.aspectRatio}
          />
        )}
        {lesson.contentType === "carousel" && translation.carouselSlides && (
          <CarouselLessonViewer
            lessonId={lesson.id}
            slides={translation.carouselSlides as CarouselSlide[]}
            disableTracking
            aspectRatio={translation.aspectRatio}
          />
        )}
      </ReelsShell>
      <Link
        href={`/preview/${token}/browse`}
        className="fixed top-3 right-4 z-40 inline-flex items-center gap-1.5 rounded-full bg-amber-400/90 px-2.5 py-1 text-[11px] font-medium text-amber-950 backdrop-blur hover:bg-amber-300"
      >
        Preview · {header.clientName}
      </Link>
    </>
  );
}
