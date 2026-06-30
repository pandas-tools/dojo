"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import MuxPlayer from "@mux/mux-player-react";
import { useLessonTracking } from "@/lib/useLessonTracking";

const COMPLETION_THRESHOLD = 0.9;

/**
 * VideoLessonViewer — Mux-backed video viewer used inside the Reels feed.
 *
 * Controls live in the parent (ReelsFeed) per the Reels/TikTok pattern:
 *   - tap toggles mute (parent owns `muted`)
 *   - press-hold pauses (parent owns `paused`)
 * There are no in-viewer buttons; the whole shell is the gesture target.
 */
export default function VideoLessonViewer({
  lessonId,
  playbackId,
  title,
  subtitlesEnabled,
  disableTracking = false,
  active = true,
  muted,
  paused,
}: {
  lessonId: string;
  playbackId: string;
  title?: string;
  subtitlesEnabled?: boolean;
  disableTracking?: boolean;
  /** Unused — viewer uses object-fit: contain so the player letterboxes
   *  itself to the video's native aspect regardless. Kept for parity. */
  aspectRatio?: number | null;
  /** Reels-feed mode: only the active lesson autoplays + emits tracking. Inactive
   *  lessons stay mounted (so swipe-in is instant) but paused and silent. */
  active?: boolean;
  /** Mute state owned by the parent (tap-to-toggle). Defaults to true. */
  muted?: boolean;
  /** Press-hold pause flag owned by the parent. Defaults to false. */
  paused?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const playerRef = useRef<HTMLElement | null>(null);

  const { emitCompleted } = useLessonTracking({
    lessonId,
    contentType: "video",
    videoPlaying: playing && active,
    enabled: !disableTracking && active,
  });

  const completedRef = useRef(false);

  const onTimeUpdate = useCallback(
    (e: Event) => {
      if (completedRef.current) return;
      if (!active) return;
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
    [emitCompleted, active],
  );

  // Drive play/pause from active + paused. Inactive lessons stay paused;
  // active lessons play unless the user is currently pressing to pause.
  useEffect(() => {
    const el = playerRef.current as unknown as
      | { play?: () => Promise<void>; pause?: () => void }
      | null;
    if (!el) return;
    if (active && !paused) {
      el.play?.().catch(() => {});
    } else {
      el.pause?.();
    }
  }, [active, paused]);

  // Mux Player honors `--media-object-fit` on the host element to pass
  // through to the inner video. `contain` makes the video respect its
  // native aspect and letterbox the rest with the section's black
  // background.
  //
  // `--controls: none` (from media-chrome) suppresses the entire default
  // control bar (mute, scrubber, fullscreen, etc.). The shell gestures
  // own all interaction — tap = mute, press-hold = pause. The cast keeps
  // Mux's narrowed prop type happy.
  const playerStyle: Record<string, string> = {
    height: "100%",
    width: "100%",
    "--media-object-fit": "contain",
    "--controls": "none",
  };

  return (
    <div className="relative h-full w-full">
      <MuxPlayer
        ref={(el) => {
          playerRef.current = el as unknown as HTMLElement;
        }}
        streamType="on-demand"
        playbackId={playbackId}
        metadata={{ video_title: title }}
        accentColor="#10b981"
        autoPlay={active ? "muted" : false}
        muted={muted ?? true}
        loop
        playsInline
        nohotkeys
        defaultHiddenCaptions={!subtitlesEnabled}
        preload={active ? "auto" : "metadata"}
        style={playerStyle}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={onTimeUpdate}
      />
    </div>
  );
}
