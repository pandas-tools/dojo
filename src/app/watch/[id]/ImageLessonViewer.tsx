"use client";

import { useEffect } from "react";
import {
  useLessonTracking,
  type LessonCompletedResponse,
} from "@/lib/useLessonTracking";

const COMPLETION_DWELL_MS = 5_000;

export default function ImageLessonViewer({
  lessonId,
  imageUrl,
  imageAlt,
  disableTracking = false,
  active = true,
  onProgress,
  onLessonCompleted,
}: {
  lessonId: string;
  imageUrl: string;
  imageAlt: string;
  disableTracking?: boolean;
  /** Unused at present — viewport sizing uses object-contain so the image
   *  is shown at its native aspect regardless. Kept in the prop set for
   *  parity with the other viewers. */
  aspectRatio?: number | null;
  /** Reels-feed mode: only the active lesson runs the dwell-completion timer. */
  active?: boolean;
  /** Emitted as the dwell timer ticks; 0..1 over COMPLETION_DWELL_MS. */
  onProgress?: (lessonId: string, pct: number) => void;
  /** Bubbled from the tracker after the server accepts a lesson_completed. */
  onLessonCompleted?: (r: LessonCompletedResponse) => void;
}) {
  const { emitCompleted } = useLessonTracking({
    lessonId,
    contentType: "image",
    enabled: !disableTracking && active,
    onCompleted: onLessonCompleted,
  });

  useEffect(() => {
    if (!active) return;
    onProgress?.(lessonId, 0);
    let elapsed = 0;
    let lastTick = Date.now();
    const interval = window.setInterval(() => {
      const now = Date.now();
      if (document.visibilityState === "visible") {
        elapsed += now - lastTick;
      }
      lastTick = now;
      const pct = Math.max(0, Math.min(1, elapsed / COMPLETION_DWELL_MS));
      onProgress?.(lessonId, pct);
      if (elapsed >= COMPLETION_DWELL_MS) {
        window.clearInterval(interval);
        if (!disableTracking) emitCompleted({ dwellMs: elapsed });
      }
    }, 100);
    return () => window.clearInterval(interval);
  }, [emitCompleted, disableTracking, active, onProgress, lessonId]);

  return (
    <div className="relative h-full w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={imageAlt}
        className="absolute inset-0 h-full w-full object-contain"
        draggable={false}
      />
    </div>
  );
}
