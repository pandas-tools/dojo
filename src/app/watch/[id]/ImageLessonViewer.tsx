"use client";

import { useEffect, useState } from "react";
import { useLessonTracking } from "@/lib/useLessonTracking";

const COMPLETION_DWELL_MS = 5_000;

export default function ImageLessonViewer({
  lessonId,
  imageUrl,
  imageAlt,
}: {
  lessonId: string;
  imageUrl: string;
  imageAlt: string;
}) {
  const { emitCompleted } = useLessonTracking({
    lessonId,
    contentType: "image",
  });

  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    // 5-second visible-dwell timer. We don't fight the visibility API ourselves
    // since useLessonTracking's heartbeat already won't engage when the tab
    // is hidden — this is just the time-on-content threshold.
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
        setCompleted(true);
        emitCompleted({ dwellMs: elapsed });
      }
    }, 250);
    return () => window.clearInterval(interval);
  }, [emitCompleted]);

  return (
    <div className="relative aspect-square sm:aspect-[4/5] rounded-md overflow-hidden bg-black mb-6 mx-auto max-w-xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={imageAlt}
        className="h-full w-full object-contain"
      />
      {completed && (
        <div className="absolute bottom-3 left-3 rounded-full bg-emerald-500/90 text-white text-xs font-medium px-2.5 py-1">
          Completed
        </div>
      )}
    </div>
  );
}
