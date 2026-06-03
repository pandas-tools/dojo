import { notFound } from "next/navigation";
import Link from "next/link";
import { verifyPreviewToken } from "@/lib/preview-tokens";
import { loadPreviewWatch } from "@/lib/preview-data";
import type { CarouselSlide } from "@/lib/db/schema";
import VideoLessonViewer from "@/app/watch/[id]/VideoLessonViewer";
import ImageLessonViewer from "@/app/watch/[id]/ImageLessonViewer";
import CarouselLessonViewer from "@/app/watch/[id]/CarouselLessonViewer";

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

  const data = await loadPreviewWatch(payload.clientId, lessonId);
  if (!data) notFound();
  const { header, lesson, translation } = data;

  return (
    <main className="min-h-screen bg-zinc-900 text-zinc-50">
      <PreviewBanner clientName={header.clientName} token={token} />
      <header className="border-b border-zinc-800">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <Link
            href={`/preview/${token}/browse`}
            className="text-sm text-zinc-300 hover:text-white"
          >
            ← Back
          </Link>
          <span className="text-xs text-zinc-500">{header.clientName}</span>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-2xl font-semibold mb-2">{translation.title}</h1>
        {translation.description && (
          <p className="text-zinc-300 mb-6">{translation.description}</p>
        )}

        <div className="mb-6">
          {lesson.contentType === "video" && translation.muxPlaybackId && (
            <div className="aspect-video rounded-md overflow-hidden bg-black">
              <VideoLessonViewer
                lessonId={lesson.id}
                playbackId={translation.muxPlaybackId}
                title={translation.title}
                subtitlesEnabled
                disableTracking
              />
            </div>
          )}
          {lesson.contentType === "image" && translation.imageUrl && (
            <ImageLessonViewer
              lessonId={lesson.id}
              imageUrl={translation.imageUrl}
              imageAlt={translation.imageAlt ?? translation.title}
              disableTracking
            />
          )}
          {lesson.contentType === "carousel" && translation.carouselSlides && (
            <CarouselLessonViewer
              lessonId={lesson.id}
              slides={translation.carouselSlides as CarouselSlide[]}
              disableTracking
            />
          )}
        </div>

        <div className="rounded-md border border-zinc-700 bg-zinc-800/40 p-4 text-sm text-zinc-300">
          Rating is disabled in preview mode. Employees see a 1–5 star widget
          here after viewing.
        </div>

        {translation.notesMarkdown && (
          <details className="mt-8 rounded-md border border-zinc-800 p-4 text-sm">
            <summary className="cursor-pointer font-medium">Notes</summary>
            <div className="mt-3 whitespace-pre-wrap text-zinc-300">
              {translation.notesMarkdown}
            </div>
          </details>
        )}
      </section>
    </main>
  );
}

function PreviewBanner({
  clientName,
  token,
}: {
  clientName: string;
  token: string;
}) {
  return (
    <div className="bg-amber-100 text-amber-900 text-xs px-4 py-2 text-center">
      <span className="font-medium">Preview mode</span> · viewing as a{" "}
      {clientName} employee · ratings and analytics are disabled ·{" "}
      <Link
        href={`/preview/${token}/browse`}
        className="underline underline-offset-2"
      >
        all lessons
      </Link>
    </div>
  );
}
