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
  onProgress,
  onSeekReady,
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
  /** Emitted on each timeupdate while active; pct is currentTime/duration.
   *  The lessonId is sent back so the parent can route updates to the right
   *  bar without per-lesson closures (which the React Compiler lint rejects). */
  onProgress?: (lessonId: string, pct: number) => void;
  /** Registers a seek(pct) fn with the parent while active; null on cleanup. */
  onSeekReady?: (
    lessonId: string,
    seek: ((pct: number) => void) | null,
  ) => void;
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
      const t = e.target as HTMLMediaElement;
      if (!active) return;
      if (!t.duration || !Number.isFinite(t.duration) || t.duration <= 0) return;
      const pct = Math.max(0, Math.min(1, t.currentTime / t.duration));
      onProgress?.(lessonId, pct);
      if (!completedRef.current && pct >= COMPLETION_THRESHOLD) {
        completedRef.current = true;
        emitCompleted({
          currentTime: t.currentTime,
          duration: t.duration,
          pct,
        });
      }
    },
    [emitCompleted, active, onProgress, lessonId],
  );

  // Register a seek(pct) hook with the parent while this lesson is active so
  // the parent's scrubber can drive the video. Unregister on inactive/unmount.
  useEffect(() => {
    if (!active || !onSeekReady) return;
    const seek = (pct: number) => {
      const el = playerRef.current as unknown as HTMLMediaElement | null;
      if (!el) return;
      const dur = el.duration;
      if (!Number.isFinite(dur) || dur <= 0) return;
      el.currentTime = Math.max(0, Math.min(1, pct)) * dur;
    };
    onSeekReady(lessonId, seek);
    return () => onSeekReady(lessonId, null);
  }, [active, onSeekReady, lessonId]);

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
  // through to the inner video. `cover` fills the reels container edge-to-
  // edge and crops anything outside the container's aspect — desired for
  // vertical reel content whose native ratio is ~9:16.
  //
  // `--controls: none` (from media-chrome) suppresses the entire default
  // control bar (mute, scrubber, fullscreen, etc.). The shell gestures
  // own all interaction — tap = mute, press-hold = pause. The cast keeps
  // Mux's narrowed prop type happy.
  const playerStyle: Record<string, string> = {
    height: "100%",
    width: "100%",
    "--media-object-fit": "cover",
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
