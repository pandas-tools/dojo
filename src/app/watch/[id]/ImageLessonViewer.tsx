"use client";

import { useEffect } from "react";
import { useLessonTracking } from "@/lib/useLessonTracking";

const COMPLETION_DWELL_MS = 5_000;

export default function ImageLessonViewer({
  lessonId,
  imageUrl,
  imageAlt,
  disableTracking = false,
  aspectRatio,
}: {
  lessonId: string;
  imageUrl: string;
  imageAlt: string;
  disableTracking?: boolean;
  /** width/height. Used to reserve correct layout space before the image loads. */
  aspectRatio?: number | null;
}) {
  const { emitCompleted } = useLessonTracking({
    lessonId,
    contentType: "image",
    enabled: !disableTracking,
  });

  useEffect(() => {
    if (disableTracking) return;
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
  }, [emitCompleted, disableTracking]);

  const ar = aspectRatio && aspectRatio > 0 ? aspectRatio : 9 / 16;

  return (
    <div
      className="relative max-h-full max-w-full"
      style={{ aspectRatio: String(ar), height: "100dvh" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={imageAlt}
        className="h-full w-full object-cover"
        draggable={false}
      />
    </div>
  );
}
