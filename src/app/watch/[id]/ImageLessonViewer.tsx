"use client";

import { useEffect } from "react";
import { useLessonTracking } from "@/lib/useLessonTracking";

const COMPLETION_DWELL_MS = 5_000;

export default function ImageLessonViewer({
  lessonId,
  imageUrl,
  imageAlt,
  disableTracking = false,
  active = true,
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
}) {
  const { emitCompleted } = useLessonTracking({
    lessonId,
    contentType: "image",
    enabled: !disableTracking && active,
  });

  useEffect(() => {
    if (disableTracking || !active) return;
    let elapsed = 0;
    let lastTick = Date.now();
    const interval = window.setInterval(() => {
      const now = Date.now();
      if (document.visibilityState === "visible") {
        elapsed += now - lastTick;
      }
      lastTick = now;
      if (elapsed >= COMPLETION_DWELL_MS) {
        window.clearInterval(interval);
        emitCompleted({ dwellMs: elapsed });
      }
    }, 250);
    return () => window.clearInterval(interval);
  }, [emitCompleted, disableTracking, active]);

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
