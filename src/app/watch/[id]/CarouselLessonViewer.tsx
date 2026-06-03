"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLessonTracking } from "@/lib/useLessonTracking";
import { cn } from "@/lib/cn";

type Slide = { url: string; alt: string; caption?: string };

export default function CarouselLessonViewer({
  lessonId,
  slides,
  disableTracking = false,
}: {
  lessonId: string;
  slides: Slide[];
  disableTracking?: boolean;
}) {
  const { emitCompleted } = useLessonTracking({
    lessonId,
    contentType: "carousel",
    enabled: !disableTracking,
  });

  const [index, setIndex] = useState(0);
  const viewedRef = useRef<Set<number>>(new Set([0]));
  const containerRef = useRef<HTMLDivElement | null>(null);

  const goTo = useCallback(
    (next: number) => {
      const bounded = Math.max(0, Math.min(slides.length - 1, next));
      setIndex(bounded);
      viewedRef.current.add(bounded);
      if (viewedRef.current.size >= slides.length) {
        emitCompleted({
          totalSlides: slides.length,
          slidesViewedPct: 1,
        });
      }
    },
    [emitCompleted, slides.length],
  );

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goTo(index + 1);
      else if (e.key === "ArrowLeft") goTo(index - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, index]);

  // Touch swipe
  const touchStartX = useRef<number | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStartX.current;
    const end = e.changedTouches[0]?.clientX ?? null;
    if (start === null || end === null) return;
    const dx = end - start;
    if (Math.abs(dx) < 40) return;
    if (dx < 0) goTo(index + 1);
    else goTo(index - 1);
  }

  const slide = slides[index];
  const slidesViewedPct = useMemo(
    () => Math.round((viewedRef.current.size / slides.length) * 100),
    // We deliberately recompute on `index` change so the % indicator refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [index, slides.length],
  );

  if (!slide) return null;

  return (
    <div
      ref={containerRef}
      className="relative mx-auto max-w-xl select-none"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="relative aspect-square sm:aspect-[4/5] rounded-md overflow-hidden bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={slide.url}
          alt={slide.alt}
          className="h-full w-full object-contain"
        />

        {slide.caption && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent text-white text-sm">
            {slide.caption}
          </div>
        )}

        {/* Prev/next chevrons (desktop) */}
        {index > 0 && (
          <button
            type="button"
            aria-label="Previous slide"
            onClick={() => goTo(index - 1)}
            className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {index < slides.length - 1 && (
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => goTo(index + 1)}
            className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Dot indicator */}
      <div className="mt-3 flex items-center justify-center gap-1.5">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === index
                ? "w-6 bg-zinc-100"
                : viewedRef.current.has(i)
                  ? "w-1.5 bg-zinc-400"
                  : "w-1.5 bg-zinc-700",
            )}
          />
        ))}
      </div>

      <p className="mt-2 text-center text-xs text-zinc-400">
        Slide {index + 1} of {slides.length} · {slidesViewedPct}% viewed
      </p>
    </div>
  );
}
