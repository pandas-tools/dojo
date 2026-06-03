"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLessonTracking } from "@/lib/useLessonTracking";
import { cn } from "@/lib/cn";

type Slide = { url: string; alt: string; caption?: string };

export default function CarouselLessonViewer({
  lessonId,
  slides,
  disableTracking = false,
  aspectRatio,
}: {
  lessonId: string;
  slides: Slide[];
  disableTracking?: boolean;
  /** width/height of the slides. All slides assumed consistent. Default 9:16. */
  aspectRatio?: number | null;
}) {
  const { emitCompleted } = useLessonTracking({
    lessonId,
    contentType: "carousel",
    enabled: !disableTracking,
  });

  const [index, setIndex] = useState(0);
  const viewedRef = useRef<Set<number>>(new Set([0]));

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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goTo(index + 1);
      else if (e.key === "ArrowLeft") goTo(index - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, index]);

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

  // Tap left/right halves to navigate (Reels-style).
  function onClick(e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 2) goTo(index - 1);
    else goTo(index + 1);
  }

  const slide = slides[index];
  if (!slide) return null;

  const ar = aspectRatio && aspectRatio > 0 ? aspectRatio : 9 / 16;

  return (
    <div
      className="relative max-h-full max-w-full select-none"
      style={{ aspectRatio: String(ar), height: "100dvh" }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onClick={onClick}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={slide.url}
        alt={slide.alt}
        className="h-full w-full object-cover"
        draggable={false}
      />

      {/* Slide progress bars — Instagram-stories style */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex gap-1">
        {slides.map((_, i) => (
          <div
            key={i}
            className="h-0.5 flex-1 rounded-full bg-white/30 overflow-hidden"
          >
            <div
              className={cn(
                "h-full rounded-full bg-white transition-all duration-300",
                i < index ? "w-full" : i === index ? "w-full" : "w-0",
              )}
            />
          </div>
        ))}
      </div>

      {slide.caption && (
        <div className="pointer-events-none absolute inset-x-0 bottom-32 z-10 px-5">
          <p className="rounded-lg bg-black/55 backdrop-blur-sm px-3 py-2 text-sm text-white">
            {slide.caption}
          </p>
        </div>
      )}
    </div>
  );
}
