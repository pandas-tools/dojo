import { notFound } from "next/navigation";
import Link from "next/link";
import { verifyPreviewToken } from "@/lib/preview-tokens";
import { loadPreviewBrowse, loadPreviewWatch } from "@/lib/preview-data";
import type { CarouselSlide } from "@/lib/db/schema";
import VideoLessonViewer from "@/app/watch/[id]/VideoLessonViewer";
import ImageLessonViewer from "@/app/watch/[id]/ImageLessonViewer";
import CarouselLessonViewer from "@/app/watch/[id]/CarouselLessonViewer";
import ReelsFeed, {
  ActiveAware,
  type FeedItem,
} from "@/app/watch/[id]/ReelsFeed";

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

  const browse = await loadPreviewBrowse(payload.clientId);
  if (!browse || browse.lessons.length === 0) notFound();

  // We need full lesson + translation rows per item for the viewers, which
  // loadPreviewBrowse doesn't return — call loadPreviewWatch for each. The
  // happy path is a handful of lessons so the fan-out is bounded.
  const fetched = await Promise.all(
    browse.lessons.map((b) => loadPreviewWatch(payload.clientId, b.lessonId)),
  );
  const ready = fetched.filter((x): x is NonNullable<typeof x> => x !== null);
  if (ready.length === 0) notFound();

  const initialId = ready.some((r) => r.lesson.id === lessonId)
    ? lessonId
    : ready[0]!.lesson.id;

  const items: FeedItem[] = ready.map(({ lesson, translation }) => ({
    id: lesson.id,
    title: translation.title,
    description: translation.description,
    node: (
      <ActiveAware>
        {(active) => {
          if (lesson.contentType === "video" && translation.muxPlaybackId) {
            return (
              <VideoLessonViewer
                lessonId={lesson.id}
                playbackId={translation.muxPlaybackId}
                title={translation.title}
                subtitlesEnabled
                disableTracking
                aspectRatio={translation.aspectRatio}
                active={active}
              />
            );
          }
          if (lesson.contentType === "image" && translation.imageUrl) {
            return (
              <ImageLessonViewer
                lessonId={lesson.id}
                imageUrl={translation.imageUrl}
                imageAlt={translation.imageAlt ?? translation.title}
                disableTracking
                aspectRatio={translation.aspectRatio}
                active={active}
              />
            );
          }
          if (lesson.contentType === "carousel" && translation.carouselSlides) {
            return (
              <CarouselLessonViewer
                lessonId={lesson.id}
                slides={translation.carouselSlides as CarouselSlide[]}
                disableTracking
                aspectRatio={translation.aspectRatio}
                active={active}
              />
            );
          }
          return null;
        }}
      </ActiveAware>
    ),
  }));

  return (
    <>
      <ReelsFeed
        items={items}
        initialId={initialId}
        backHref={`/preview/${token}/browse`}
        buildHref={(id) => `/preview/${token}/watch/${id}`}
      />
      <Link
        href={`/preview/${token}/browse`}
        className="fixed top-3 right-4 z-50 inline-flex items-center gap-1.5 rounded-full bg-amber-400/90 px-2.5 py-1 text-[11px] font-medium text-amber-950 backdrop-blur hover:bg-amber-300"
      >
        Preview · {browse.header.clientName}
      </Link>
    </>
  );
}
