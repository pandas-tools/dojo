import { notFound } from "next/navigation";
import Link from "next/link";
import { verifyPreviewToken } from "@/lib/preview-tokens";
import { loadPreviewBrowse, loadPreviewWatch } from "@/lib/preview-data";
import type { CarouselSlide } from "@/lib/db/schema";
import ReelsFeed, { type FeedItem } from "@/app/watch/[id]/ReelsFeed";

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

  const fetched = await Promise.all(
    browse.lessons.map((b) => loadPreviewWatch(payload.clientId, b.lessonId)),
  );
  const ready = fetched.filter((x): x is NonNullable<typeof x> => x !== null);
  if (ready.length === 0) notFound();

  const items: FeedItem[] = [];
  for (const { lesson, translation } of ready) {
    if (lesson.contentType === "video" && translation.muxPlaybackId) {
      items.push({
        id: lesson.id,
        title: translation.title,
        description: translation.description,
        content: {
          type: "video",
          playbackId: translation.muxPlaybackId,
          aspectRatio: translation.aspectRatio,
        },
      });
    } else if (lesson.contentType === "image" && translation.imageUrl) {
      items.push({
        id: lesson.id,
        title: translation.title,
        description: translation.description,
        content: {
          type: "image",
          imageUrl: translation.imageUrl,
          imageAlt: translation.imageAlt ?? translation.title,
          aspectRatio: translation.aspectRatio,
        },
      });
    } else if (lesson.contentType === "carousel") {
      const slides = (translation.carouselSlides ?? []) as CarouselSlide[];
      if (slides.length >= 2) {
        items.push({
          id: lesson.id,
          title: translation.title,
          description: translation.description,
          content: { type: "carousel", slides, aspectRatio: translation.aspectRatio },
        });
      }
    }
  }
  if (items.length === 0) notFound();

  const initialId = items.some((i) => i.id === lessonId)
    ? lessonId
    : items[0]!.id;

  return (
    <>
      <ReelsFeed
        items={items}
        initialId={initialId}
        backHref={`/preview/${token}/browse`}
        urlPrefix={`/preview/${token}/watch/`}
        disableTracking
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
