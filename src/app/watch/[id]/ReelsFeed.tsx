"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronUp, ChevronDown, Heart, MessageSquare } from "lucide-react";
import { cn } from "@/lib/cn";
import type { CarouselSlide } from "@/lib/db/schema";
import VideoLessonViewer from "./VideoLessonViewer";
import ImageLessonViewer from "./ImageLessonViewer";
import CarouselLessonViewer from "./CarouselLessonViewer";

const OVERLAY_AUTO_FADE_MS = 3000;

export type FeedItemContent =
  | {
      type: "video";
      playbackId: string;
      aspectRatio: number | null;
    }
  | {
      type: "image";
      imageUrl: string;
      imageAlt: string;
      aspectRatio: number | null;
    }
  | {
      type: "carousel";
      slides: CarouselSlide[];
      aspectRatio: number | null;
    };

export type FeedItem = {
  /** Lesson id — drives URL sync. */
  id: string;
  title: string;
  description: string | null;
  content: FeedItemContent;
};

export default function ReelsFeed({
  items,
  initialId,
  backHref,
  urlPrefix,
  disableTracking = false,
  initialUpvoted,
}: {
  items: FeedItem[];
  initialId: string;
  backHref: string;
  /** Per-lesson URL is built as `urlPrefix + id`. Use "/watch/" for the real
   *  feed and "/preview/<token>/watch/" for the preview surface. */
  urlPrefix: string;
  /** True in preview mode — no tracking events fire. */
  disableTracking?: boolean;
  /** Set of lesson ids the user has already upvoted. Drives the filled-Heart
   *  state for the matching lesson in the feed; empty/omitted in preview. */
  initialUpvoted?: Set<string>;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const initialIndex = useMemo(() => {
    const i = items.findIndex((it) => it.id === initialId);
    return i >= 0 ? i : 0;
  }, [items, initialId]);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const fadeTimerRef = useRef<number | null>(null);
  const [upvoted, setUpvoted] = useState<Set<string>>(
    () => new Set(initialUpvoted ?? []),
  );
  const upvotePendingRef = useRef<Set<string>>(new Set());

  const toggleUpvote = useCallback(async () => {
    if (disableTracking) return;
    const lesson = items[activeIndex];
    if (!lesson) return;
    const lessonId = lesson.id;
    if (upvotePendingRef.current.has(lessonId)) return;
    upvotePendingRef.current.add(lessonId);

    const wasUpvoted = upvoted.has(lessonId);
    setUpvoted((prev) => {
      const next = new Set(prev);
      if (wasUpvoted) next.delete(lessonId);
      else next.add(lessonId);
      return next;
    });

    try {
      const res = await fetch(`/api/lessons/${lessonId}/upvote`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`upvote failed: ${res.status}`);
      const body = (await res.json()) as { upvoted: boolean };
      setUpvoted((prev) => {
        const next = new Set(prev);
        if (body.upvoted) next.add(lessonId);
        else next.delete(lessonId);
        return next;
      });
    } catch {
      setUpvoted((prev) => {
        const next = new Set(prev);
        if (wasUpvoted) next.add(lessonId);
        else next.delete(lessonId);
        return next;
      });
    } finally {
      upvotePendingRef.current.delete(lessonId);
    }
  }, [activeIndex, disableTracking, items, upvoted]);

  function armFade() {
    if (fadeTimerRef.current !== null) window.clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = window.setTimeout(() => {
      setOverlayVisible(false);
    }, OVERLAY_AUTO_FADE_MS);
  }

  // Scroll to the initial lesson on mount.
  useEffect(() => {
    const el = sectionRefs.current.get(items[initialIndex]?.id ?? "");
    if (el) el.scrollIntoView({ behavior: "auto", block: "start" });
    armFade();
    return () => {
      if (fadeTimerRef.current !== null) window.clearTimeout(fadeTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track which section is in view.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const obs = new IntersectionObserver(
      (entries) => {
        let best: IntersectionObserverEntry | null = null;
        for (const e of entries) {
          if (e.intersectionRatio < 0.6) continue;
          if (!best || e.intersectionRatio > best.intersectionRatio) best = e;
        }
        if (!best) return;
        const id = (best.target as HTMLElement).dataset.lessonId;
        if (!id) return;
        const idx = items.findIndex((it) => it.id === id);
        if (idx < 0) return;
        setActiveIndex(idx);
        setOverlayVisible(true);
        armFade();
      },
      {
        root: container,
        threshold: [0.4, 0.6, 0.8, 1.0],
      },
    );
    sectionRefs.current.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // Sync URL with active lesson.
  useEffect(() => {
    const cur = items[activeIndex];
    if (!cur) return;
    const url = urlPrefix + cur.id;
    if (typeof window !== "undefined" && window.location.pathname !== url) {
      window.history.replaceState(window.history.state, "", url);
    }
  }, [activeIndex, items, urlPrefix]);

  const gotoIndex = useCallback(
    (next: number) => {
      const total = items.length;
      if (total === 0) return;
      const wrapped = ((next % total) + total) % total;
      const target = items[wrapped];
      if (!target) return;
      const el = sectionRefs.current.get(target.id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [items],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        gotoIndex(activeIndex + 1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        gotoIndex(activeIndex - 1);
      } else if (e.key === "Escape") {
        router.push(backHref);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, gotoIndex, router, backHref]);

  function onShellTap() {
    setOverlayVisible((v) => {
      const next = !v;
      if (next) armFade();
      return next;
    });
  }

  const current = items[activeIndex];

  return (
    <main className="fixed inset-0 bg-black text-white overflow-hidden touch-none select-none">
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-y-scroll snap-y snap-mandatory overscroll-y-contain"
        style={{ touchAction: "pan-y", scrollbarWidth: "none" }}
      >
        {items.map((it, i) => {
          const active = i === activeIndex;
          return (
            <section
              key={it.id}
              ref={(el) => {
                if (el) sectionRefs.current.set(it.id, el);
                else sectionRefs.current.delete(it.id);
              }}
              data-lesson-id={it.id}
              onClick={onShellTap}
              className="relative snap-start flex items-center justify-center bg-black"
              style={{ height: "100dvh", width: "100%" }}
            >
              {it.content.type === "video" && (
                <VideoLessonViewer
                  lessonId={it.id}
                  playbackId={it.content.playbackId}
                  title={it.title}
                  subtitlesEnabled
                  aspectRatio={it.content.aspectRatio}
                  active={active}
                  disableTracking={disableTracking}
                />
              )}
              {it.content.type === "image" && (
                <ImageLessonViewer
                  lessonId={it.id}
                  imageUrl={it.content.imageUrl}
                  imageAlt={it.content.imageAlt}
                  aspectRatio={it.content.aspectRatio}
                  active={active}
                  disableTracking={disableTracking}
                />
              )}
              {it.content.type === "carousel" && (
                <CarouselLessonViewer
                  lessonId={it.id}
                  slides={it.content.slides}
                  aspectRatio={it.content.aspectRatio}
                  active={active}
                  disableTracking={disableTracking}
                />
              )}
            </section>
          );
        })}
      </div>

      {/* TITLE CHIP — middle-screen quote pill, fades with overlay */}
      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 z-40 flex justify-center px-6 transition-opacity duration-300",
          overlayVisible ? "opacity-100" : "opacity-0",
        )}
        style={{ top: "calc(60% - 1rem)" }}
      >
        <div
          className="rounded-[8px] bg-[rgba(14,14,14,0.6)] px-4 py-3 backdrop-blur-md"
          style={{ maxWidth: "min(90%, 360px)" }}
        >
          <p className="text-center text-[18px] font-medium leading-[1.2] tracking-tight text-[#f9fdff]">
            {current?.title}
          </p>
        </div>
      </div>

      {/* BOTTOM OVERLAY — lesson name + description on left, interaction icons on right */}
      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-0 z-50 transition-opacity duration-300",
          overlayVisible ? "opacity-100" : "opacity-0",
        )}
        style={{
          backgroundImage:
            "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.55) 50%, rgba(0,0,0,0) 100%)",
          transform: "translateZ(0)",
          willChange: "opacity",
        }}
      >
        <div
          className="flex items-end gap-2 px-6 pb-10 pt-10"
          style={{
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 2.5rem)",
          }}
        >
          {/* Left column: lesson name + description */}
          <div className="flex flex-1 flex-col gap-2 text-[#f9fdff]">
            <p
              className="text-[20px] font-normal leading-[1.3]"
              style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
            >
              {current?.title}
            </p>
            {current?.description && (
              <p
                className="text-[16px] font-normal leading-[1.3]"
                style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
              >
                {current.description}
              </p>
            )}
          </div>

          {/* Right column: stacked interaction icons */}
          <div className="pointer-events-auto flex flex-col items-center gap-4 pl-2">
            <button
              type="button"
              aria-label={current && upvoted.has(current.id) ? "Remove upvote" : "Upvote"}
              aria-pressed={current ? upvoted.has(current.id) : false}
              onClick={(e) => {
                e.stopPropagation();
                void toggleUpvote();
              }}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-[rgba(14,14,14,0.55)] text-[#f9fdff] backdrop-blur-md transition-colors hover:bg-[rgba(14,14,14,0.7)]"
            >
              <Heart
                className={cn(
                  "h-5 w-5 transition-colors",
                  current && upvoted.has(current.id)
                    ? "fill-red-500 text-red-500"
                    : "",
                )}
                strokeWidth={2}
              />
            </button>
            <button
              type="button"
              aria-label="Notes"
              onClick={(e) => e.stopPropagation()}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-[rgba(14,14,14,0.55)] text-[#f9fdff] backdrop-blur-md transition-colors hover:bg-[rgba(14,14,14,0.7)]"
            >
              <MessageSquare className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Progress bar at the very bottom edge */}
        <div className="h-1 w-full bg-white/12">
          <div
            className="h-full bg-[#c1e8fb] transition-[width] duration-300 ease-out"
            style={{
              width: `${
                items.length > 0 ? ((activeIndex + 1) / items.length) * 100 : 0
              }%`,
            }}
          />
        </div>
      </div>

      {/* Persistent back button — 48px circular, never fades */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-50"
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          transform: "translateZ(0)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-20"
          style={{
            backgroundImage:
              "linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,0))",
          }}
          aria-hidden
        />
        <div className="relative flex px-6 pt-4">
          <Link
            href={backHref}
            aria-label="Back to lessons"
            onClick={(e) => e.stopPropagation()}
            className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-[rgba(14,14,14,0.55)] text-[#f9fdff] backdrop-blur-md transition-colors hover:bg-[rgba(14,14,14,0.7)]"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2} />
          </Link>
        </div>
      </div>

      {/* Desktop-only vertical arrow controls */}
      {items.length > 1 && (
        <div className="pointer-events-none fixed right-3 top-1/2 -translate-y-1/2 z-50 hidden sm:flex flex-col gap-2">
          <button
            type="button"
            aria-label="Previous lesson"
            onClick={(e) => {
              e.stopPropagation();
              gotoIndex(activeIndex - 1);
            }}
            className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/55 backdrop-blur text-white hover:bg-black/70 transition-colors"
          >
            <ChevronUp className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Next lesson"
            onClick={(e) => {
              e.stopPropagation();
              gotoIndex(activeIndex + 1);
            }}
            className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/55 backdrop-blur text-white hover:bg-black/70 transition-colors"
          >
            <ChevronDown className="h-5 w-5" />
          </button>
        </div>
      )}

      <style>{`main > div::-webkit-scrollbar { display: none; }`}</style>
    </main>
  );
}
