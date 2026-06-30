"use client";

import { useEffect, useRef } from "react";

// useLessonTracking — client-side tracker for the Reels-shell content
// renderers (Mux player, Image viewer, Carousel viewer). Emits three
// generic events with content-type-specific triggers managed by the
// caller:
//
//   lesson_opened     — auto-emitted on mount, once per session.
//   lesson_engagement — auto-emitted every 15s while engaged, plus a final
//                       sendBeacon on visibilitychange-hidden / pagehide.
//   lesson_completed  — caller decides when (video 90%, image 5s dwell,
//                       all carousel slides viewed). Use the returned
//                       `emitCompleted()` callback.
//
// "Engaged" follows the same heuristic pandas-dynamic-lander uses on its
// landing-page tracker: document is visible AND (user was active in the
// last 30s OR a video is currently playing).
//
// All requests fire-and-forget — the tracker never blocks UI. Final
// engagement heartbeat uses sendBeacon so the count survives a tab close.

export type UseLessonTrackingOptions = {
  lessonId: string;
  contentType: "video" | "image" | "carousel";
  // Inform the hook when a video is actively playing — keeps engagement
  // ticking even if the user hasn't moved the mouse/keyboard for 30s but
  // is genuinely watching. Pass `false` for image / carousel lessons.
  videoPlaying?: boolean;
  // Disable the hook entirely — useful in admin preview surfaces.
  enabled?: boolean;
};

export type UseLessonTrackingResult = {
  // Emit lesson_completed with a content-type-specific payload. Caller
  // is responsible for deciding when the completion criteria are met
  // (video 90%, image dwell, carousel all-slides). Idempotent on the
  // server side, but also de-duped here so we don't fire the network
  // call twice in the same session.
  emitCompleted: (payload?: Record<string, unknown>) => void;
  // Emit lesson_opened explicitly — usually the hook auto-fires on
  // mount, but Reels-shell variants that mount a viewer before the
  // user has actually started consuming it can defer this.
  emitOpened: () => void;
};

const ENGAGEMENT_HEARTBEAT_MS = 15_000;
const IDLE_THRESHOLD_MS = 30_000;
const INPUT_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
] as const;

function sendEvent(
  lessonId: string,
  type: "lesson_opened" | "lesson_completed" | "lesson_engagement",
  payload: Record<string, unknown> | null,
  beacon = false,
) {
  const url = `/api/lessons/${lessonId}/event`;
  const body = JSON.stringify({ type, payload });
  if (beacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
    try {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(url, blob);
      return;
    } catch {
      // fall through to fetch
    }
  }
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // swallow — tracker must never break the UI
  });
}

export function useLessonTracking(
  opts: UseLessonTrackingOptions,
): UseLessonTrackingResult {
  const { lessonId, contentType, enabled = true } = opts;

  const lastActiveRef = useRef<number>(Date.now());
  const lastTickRef = useRef<number>(Date.now());
  const engagedMsRef = useRef<number>(0);
  const openedRef = useRef<boolean>(false);
  const completedRef = useRef<boolean>(false);
  // Mirror of opts.videoPlaying that the engagement timer can read
  // without re-running the effect on every re-render.
  const videoPlayingRef = useRef<boolean>(!!opts.videoPlaying);
  videoPlayingRef.current = !!opts.videoPlaying;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const onInput = () => {
      lastActiveRef.current = Date.now();
    };
    for (const ev of INPUT_EVENTS) {
      document.addEventListener(ev, onInput, { passive: true });
    }

    // 1s engagement tick — accumulates engagedMs while the user is on
    // the lesson and either interacting or has a video playing.
    const tickInterval = window.setInterval(() => {
      const now = Date.now();
      const isVisible = document.visibilityState === "visible";
      const notIdle = now - lastActiveRef.current < IDLE_THRESHOLD_MS;
      const playing = videoPlayingRef.current;
      if (isVisible && (notIdle || playing)) {
        engagedMsRef.current += now - lastTickRef.current;
      }
      lastTickRef.current = now;
    }, 1000);

    // 15s heartbeat to the server.
    const heartbeat = window.setInterval(() => {
      if (engagedMsRef.current <= 0) return;
      sendEvent(lessonId, "lesson_engagement", {
        engagedMs: engagedMsRef.current,
        contentType,
      });
    }, ENGAGEMENT_HEARTBEAT_MS);

    // Final heartbeat on tab-hide / page unload via sendBeacon.
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && engagedMsRef.current > 0) {
        sendEvent(
          lessonId,
          "lesson_engagement",
          { engagedMs: engagedMsRef.current, contentType, final: true },
          true,
        );
      }
    };
    const onPageHide = () => {
      if (engagedMsRef.current > 0) {
        sendEvent(
          lessonId,
          "lesson_engagement",
          { engagedMs: engagedMsRef.current, contentType, final: true },
          true,
        );
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    // Auto-emit lesson_opened once.
    if (!openedRef.current) {
      openedRef.current = true;
      sendEvent(lessonId, "lesson_opened", { contentType });
    }

    return () => {
      for (const ev of INPUT_EVENTS) {
        document.removeEventListener(ev, onInput);
      }
      window.clearInterval(tickInterval);
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);

      // One last heartbeat on unmount via fetch keepalive so we don't
      // lose engaged time when the user navigates away client-side
      // (which doesn't fire pagehide).
      if (engagedMsRef.current > 0) {
        sendEvent(
          lessonId,
          "lesson_engagement",
          { engagedMs: engagedMsRef.current, contentType, final: true },
          false,
        );
      }
    };
  }, [lessonId, contentType, enabled]);

  return {
    emitCompleted: (payload?: Record<string, unknown>) => {
      if (completedRef.current) return;
      completedRef.current = true;
      sendEvent(lessonId, "lesson_completed", {
        contentType,
        ...(payload ?? {}),
      });
    },
    emitOpened: () => {
      if (openedRef.current) return;
      openedRef.current = true;
      sendEvent(lessonId, "lesson_opened", { contentType });
    },
  };
}
