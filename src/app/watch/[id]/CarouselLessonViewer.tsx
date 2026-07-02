"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  useLessonTracking,
  type LessonCompletedResponse,
} from "@/lib/useLessonTracking";
import { cn } from "@/lib/cn";

type Slide = { url: string; alt: string; caption?: string };

/**
 * CarouselLessonViewer — full-bleed horizontal photo carousel (TikTok-style).
 * Each slide fills the entire card frame; a small `N/total` counter sits
 * top-right, pagination dots sit bottom-center above the title overlay.
 */
export default function CarouselLessonViewer({
  lessonId,
  slides,
  disableTracking = false,
  active = true,
  onProgress,
  onLessonCompleted,
}: {
  lessonId: string;
  slides: Slide[];
  disableTracking?: boolean;
  /** Unused — slides are object-cover inside rounded card. Kept for parity. */
  aspectRatio?: number | null;
  /** Reels-feed mode: only the active carousel emits completion. */
  active?: boolean;
  /** Emitted on slide change; pct is (index+1)/slides.length. */
  onProgress?: (lessonId: string, pct: number) => void;
  /** Bubbled from the tracker after the server accepts a lesson_completed. */
  onLessonCompleted?: (r: LessonCompletedResponse) => void;
}) {
  const { emitCompleted } = useLessonTracking({
    lessonId,
    contentType: "carousel",
    enabled: !disableTracking && active,
    onCompleted: onLessonCompleted,
  });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const viewedRef = useRef<Set<number>>(new Set([0]));
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active || slides.length === 0) return;
    onProgress?.(lessonId, (index + 1) / slides.length);
  }, [active, index, slides.length, onProgress, lessonId]);

  const markViewed = useCallback(
    (i: number) => {
      viewedRef.current.add(i);
      if (viewedRef.current.size >= slides.length && active) {
        emitCompleted({
          totalSlides: slides.length,
          slidesViewedPct: 1,
        });
      }
    },
    [emitCompleted, slides.length, active],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const obs = new IntersectionObserver(
      (entries) => {
        let best: IntersectionObserverEntry | null = null;
        for (const e of entries) {
          if (e.intersectionRatio < 0.55) continue;
          if (!best || e.intersectionRatio > best.intersectionRatio) best = e;
        }
        if (!best) return;
        const i = Number((best.target as HTMLElement).dataset.slideIndex);
        if (Number.isNaN(i)) return;
        setIndex(i);
        markViewed(i);
      },
      {
        root: container,
        threshold: [0.35, 0.55, 0.75, 1.0],
      },
    );
    slideRefs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [markViewed]);

  const gotoSlide = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(slides.length - 1, next));
      const el = slideRefs.current[clamped];
      if (el) el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    },
    [slides.length],
  );

  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        gotoSlide(index + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        gotoSlide(index - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, index, gotoSlide]);

  return (
    <div className="relative h-full w-full select-none">
      <div
        ref={containerRef}
        className="
          flex h-full w-full overflow-x-scroll
          overscroll-x-contain snap-x snap-mandatory
          [scrollbar-width:none] [-ms-overflow-style:none]
          [&::-webkit-scrollbar]:hidden
        "
        style={{ touchAction: "pan-x pan-y" }}
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            ref={(el) => {
              slideRefs.current[i] = el;
            }}
            data-slide-index={i}
            className="relative h-full w-full shrink-0 snap-center bg-black"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slide.url}
              alt={slide.alt}
              className="absolute inset-0 h-full w-full object-cover"
              draggable={false}
            />
            {slide.caption && (
              <div className="pointer-events-none absolute inset-x-4 bottom-4 z-10">
                <p className="rounded-lg bg-black/55 px-3 py-2 text-[10px] text-white backdrop-blur-sm">
                  {slide.caption}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Counter — top-right pill, `N / total`. Sits above the parent overlay
          so it stays readable regardless of underlying image. */}
      {slides.length > 1 && (
        <div
          className="pointer-events-none absolute right-4 z-50 rounded-full bg-[rgba(14,14,14,0.55)] px-2.5 py-1 text-[11px] font-medium tabular-nums text-white/90 backdrop-blur-md"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
        >
          {index + 1} / {slides.length}
        </div>
      )}

      {/* Pagination dots — bottom-center capsule, positioned above the parent
          ReelsFeed title overlay so it never sits under the title text. */}
      {slides.length > 1 && (
        <div
          className="pointer-events-none absolute left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-[rgba(14,14,14,0.55)] px-3 py-1.5 backdrop-blur-md"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 9rem)" }}
        >
          {slides.map((_, i) => {
            const isActive = i === index;
            return (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-200",
                  isActive ? "w-4 bg-arctic-haze" : "w-1.5 bg-white/40",
                )}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
