"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import MuxPlayer from "@mux/mux-player-react";
import { Volume2, VolumeX } from "lucide-react";
import { useLessonTracking } from "@/lib/useLessonTracking";

const COMPLETION_THRESHOLD = 0.9;
const SOUND_HINT_AUTO_FADE_MS = 3500;

export default function VideoLessonViewer({
  lessonId,
  playbackId,
  title,
  subtitlesEnabled,
  disableTracking = false,
  aspectRatio,
  active = true,
}: {
  lessonId: string;
  playbackId: string;
  title?: string;
  subtitlesEnabled?: boolean;
  disableTracking?: boolean;
  /** width/height. Pass when known; falls back to 9:16 for Reels-first content. */
  aspectRatio?: number | null;
  /** Reels-feed mode: only the active lesson autoplays + emits tracking. Inactive
   *  lessons stay mounted (so swipe-in is instant) but paused and silent. */
  active?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [showSoundHint, setShowSoundHint] = useState(true);
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

  useEffect(() => {
    const id = window.setTimeout(() => setShowSoundHint(false), SOUND_HINT_AUTO_FADE_MS);
    return () => window.clearTimeout(id);
  }, []);

  // Pause inactive players, play active ones. Mux Player exposes play()/pause()
  // on the element instance.
  useEffect(() => {
    const el = playerRef.current as unknown as
      | { play?: () => Promise<void>; pause?: () => void }
      | null;
    if (!el) return;
    if (active) {
      el.play?.().catch(() => {
        /* autoplay restrictions etc — ignore */
      });
    } else {
      el.pause?.();
    }
  }, [active]);

  function toggleMute(e: React.MouseEvent) {
    e.stopPropagation();
    setMuted((m) => !m);
    setShowSoundHint(false);
  }

  const ar = aspectRatio && aspectRatio > 0 ? aspectRatio : 9 / 16;

  return (
    <div
      className="relative max-h-full max-w-full"
      style={{ aspectRatio: String(ar), height: "100dvh" }}
    >
      <MuxPlayer
        ref={(el) => {
          playerRef.current = el as unknown as HTMLElement;
        }}
        streamType="on-demand"
        playbackId={playbackId}
        metadata={{ video_title: title }}
        accentColor="#10b981"
        autoPlay={active ? "muted" : false}
        muted={muted}
        loop
        playsInline
        nohotkeys
        defaultHiddenCaptions={!subtitlesEnabled}
        preload={active ? "auto" : "metadata"}
        style={{ height: "100%", width: "100%" }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={onTimeUpdate}
      />
      {active && (
        <>
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? "Unmute" : "Mute"}
            className="absolute bottom-24 right-4 z-30 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/50 backdrop-blur text-white pointer-events-auto"
          >
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          {showSoundHint && muted && (
            <div className="absolute bottom-24 right-16 z-30 rounded-full bg-black/60 backdrop-blur px-3 py-1.5 text-xs text-white pointer-events-none">
              Tap for sound
            </div>
          )}
        </>
      )}
    </div>
  );
}
