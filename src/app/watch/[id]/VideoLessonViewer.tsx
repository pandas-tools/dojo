"use client";

import { useCallback, useRef, useState } from "react";
import MuxPlayer from "@mux/mux-player-react";
import { useLessonTracking } from "@/lib/useLessonTracking";

const COMPLETION_THRESHOLD = 0.9;

export default function VideoLessonViewer({
  lessonId,
  playbackId,
  title,
  subtitlesEnabled,
}: {
  lessonId: string;
  playbackId: string;
  title?: string;
  subtitlesEnabled?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const { emitCompleted } = useLessonTracking({
    lessonId,
    contentType: "video",
    videoPlaying: playing,
  });

  const completedRef = useRef(false);

  const onTimeUpdate = useCallback(
    (e: Event) => {
      if (completedRef.current) return;
      const t = e.target as HTMLMediaElement;
      if (!t.duration || !Number.isFinite(t.duration)) return;
      const pct = t.currentTime / t.duration;
      if (pct >= COMPLETION_THRESHOLD) {
        completedRef.current = true;
        emitCompleted({
          currentTime: t.currentTime,
          duration: t.duration,
          pct,
        });
      }
    },
    [emitCompleted],
  );

  return (
    <MuxPlayer
      streamType="on-demand"
      playbackId={playbackId}
      metadata={{ video_title: title }}
      accentColor="#10b981"
      defaultShowRemainingTime
      defaultHiddenCaptions={!subtitlesEnabled}
      style={{ aspectRatio: "16/9", width: "100%" }}
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onEnded={() => setPlaying(false)}
      onTimeUpdate={onTimeUpdate}
    />
  );
}
