import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { scopedDb } from "@/lib/db/scoped";
import type { CarouselSlide } from "@/lib/db/schema";
import VideoLessonViewer from "./VideoLessonViewer";
import ImageLessonViewer from "./ImageLessonViewer";
import CarouselLessonViewer from "./CarouselLessonViewer";
import RatingWidget from "./RatingWidget";
import { signOutAction } from "../../actions";

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

  // Content-type-aware "ready" check. Returns a JSX element if the lesson
  // can't be played yet for this content type, otherwise null.
  const notReady = (() => {
    if (lesson.contentType === "video") {
      if (!translation.muxPlaybackId) {
        return (
          <NotReadyBanner
            title="Video still processing"
            detail="This lesson's video isn't ready yet. Try again in a few minutes."
          />
        );
      }
    } else if (lesson.contentType === "image") {
      if (!translation.imageUrl) {
        return (
          <NotReadyBanner
            title="Image missing"
            detail="This image lesson hasn't been set up yet."
          />
        );
      }
    } else if (lesson.contentType === "carousel") {
      const slides = (translation.carouselSlides ?? []) as CarouselSlide[];
      if (slides.length < 2) {
        return (
          <NotReadyBanner
            title="Carousel incomplete"
            detail="This carousel lesson needs at least 2 slides."
          />
        );
      }
    }
    return null;
  })();

  if (notReady) return notReady;

  const completions = await sdb.completions.forUser();
  const existing = completions.find((c) => c.lessonId === id);

  return (
    <main className="min-h-screen bg-zinc-900 text-zinc-50">
      <header className="border-b border-zinc-800">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <Link href="/browse" className="text-sm text-zinc-300 hover:text-white">
            ← Back
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-sm text-zinc-400 hover:text-white"
            >
              Sign out
            </button>
          </form>
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
                lessonId={id}
                playbackId={translation.muxPlaybackId}
                title={translation.title}
                subtitlesEnabled
              />
            </div>
          )}
          {lesson.contentType === "image" && translation.imageUrl && (
            <ImageLessonViewer
              lessonId={id}
              imageUrl={translation.imageUrl}
              imageAlt={translation.imageAlt ?? translation.title}
            />
          )}
          {lesson.contentType === "carousel" && translation.carouselSlides && (
            <CarouselLessonViewer
              lessonId={id}
              slides={translation.carouselSlides as CarouselSlide[]}
            />
          )}
        </div>

        <RatingWidget lessonId={id} initialRating={existing?.rating ?? null} />

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
