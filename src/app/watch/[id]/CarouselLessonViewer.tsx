"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLessonTracking } from "@/lib/useLessonTracking";
import { cn } from "@/lib/cn";

type Slide = { url: string; alt: string; caption?: string };

export default function CarouselLessonViewer({
  lessonId,
  slides,
  disableTracking = false,
  active = true,
}: {
  lessonId: string;
  slides: Slide[];
  disableTracking?: boolean;
  /** Unused — viewer uses object-contain so the slides render at native
   *  aspect. Kept for parity with the other viewers. */
  aspectRatio?: number | null;
  /** Reels-feed mode: only the active carousel emits completion. */
  active?: boolean;
}) {
  const { emitCompleted } = useLessonTracking({
    lessonId,
    contentType: "carousel",
    enabled: !disableTracking && active,
  });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const viewedRef = useRef<Set<number>>(new Set([0]));
  const [index, setIndex] = useState(0);

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

  // IntersectionObserver picks the currently-visible slide.
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

  // Keyboard nav — only relevant when this carousel is the active lesson.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, index, slides.length]);

  const gotoSlide = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(slides.length - 1, next));
      const el = slideRefs.current[clamped];
      if (el) el.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    },
    [slides.length],
  );

  return (
    <div className="relative h-full w-full select-none">
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-x-scroll snap-x snap-mandatory overscroll-x-contain flex"
        style={{ touchAction: "pan-x pan-y", scrollbarWidth: "none" }}
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            ref={(el) => {
              slideRefs.current[i] = el;
            }}
            data-slide-index={i}
            className="snap-start shrink-0 relative h-full"
            style={{ width: "100%" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slide.url}
              alt={slide.alt}
              className="absolute inset-0 h-full w-full object-contain"
              draggable={false}
            />
            {slide.caption && (
              <div className="pointer-events-none absolute inset-x-0 bottom-40 z-10 px-5">
                <p className="rounded-lg bg-black/55 backdrop-blur-sm px-3 py-2 text-sm text-white max-w-md mx-auto">
                  {slide.caption}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Slide-count pill — top-right, mirrors TikTok's "5/9" indicator. */}
      {slides.length > 1 && (
        <div className="pointer-events-none absolute top-3 right-3 z-20 rounded-full bg-black/55 backdrop-blur px-2 py-0.5 text-[11px] font-medium text-white">
          {index + 1} / {slides.length}
        </div>
      )}

      {/* Bottom dots — TikTok pattern, varying sizes by distance from active. */}
      {slides.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-32 z-20 flex items-center justify-center gap-1.5">
          {slides.map((_, i) => {
            const d = Math.abs(i - index);
            const size =
              d === 0 ? "h-1.5 w-1.5" : d === 1 ? "h-1.5 w-1.5" : "h-1 w-1";
            const color =
              d === 0
                ? "bg-white"
                : d === 1
                  ? "bg-white/70"
                  : d === 2
                    ? "bg-white/50"
                    : "bg-white/35";
            return (
              <span
                key={i}
                className={cn("rounded-full transition-all duration-200", size, color)}
              />
            );
          })}
        </div>
      )}

      <style>{`div::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}
