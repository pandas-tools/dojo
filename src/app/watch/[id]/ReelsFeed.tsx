"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  ThumbsUp,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { toggleBookmark as toggleBookmarkAction } from "@/app/(shell)/browse/actions";
import VideoNotesSheet, {
  NOTES_INITIAL_SNAP,
} from "@/components/VideoNotesSheet";
import NotesMarkdown from "@/components/NotesMarkdown";
import UpvoteBurst from "@/components/UpvoteBurst";
import ConfettiBurst from "@/components/ConfettiBurst";
import SuccessCard from "@/components/SuccessCard";
import AnimatedEmoji from "@/components/AnimatedEmoji";
import SuccessGroupCard, {
  type GroupRating,
} from "@/components/SuccessGroupCard";
import { nextUnwatchedIndex } from "./nextUnwatched";
import { cn } from "@/lib/cn";
import type { LessonCompletedResponse } from "@/lib/useLessonTracking";
import type { CarouselSlide } from "@/lib/db/schema";
import VideoLessonViewer from "./VideoLessonViewer";
import ImageLessonViewer from "./ImageLessonViewer";
import CarouselLessonViewer from "./CarouselLessonViewer";

// bad/meh/good/amazing → 1..5. Skips 3 so meh sits closer to bad and good
// closer to amazing — matches the felt semantic gap between "meh" and "good".
const RATING_TO_INT: Record<GroupRating, number> = {
  bad: 1,
  meh: 2,
  good: 4,
  amazing: 5,
};

export type FeedItemContent =
  | {
      type: "video";
      playbackId: string;
      aspectRatio: number | null;
    }
  | {
      type: "image";
      imageUrl: string;
      imageAlt: string;
      aspectRatio: number | null;
    }
  | {
      type: "carousel";
      slides: CarouselSlide[];
      aspectRatio: number | null;
    };

export type FeedItem = {
  /** Lesson id — drives URL sync. */
  id: string;
  title: string;
  description: string | null;
  /** Optional notes markdown — surfaced via the VideoNotesSheet. */
  notesMarkdown?: string | null;
  content: FeedItemContent;
};

/** Source URL for the lg+ ambient glow behind a lesson card. Video uses the
 *  Mux animated WebP (a few hundred KB, loops the first 5s — cheap, dynamic).
 *  Image/carousel use the lesson media itself. Returns null when no source
 *  exists (rare; we just skip the glow then). */
function glowSourceUrl(item: FeedItem): string | null {
  if (item.content.type === "video") {
    return `https://image.mux.com/${item.content.playbackId}/animated.webp?width=480&fps=15&start=0&end=5`;
  }
  if (item.content.type === "image") return item.content.imageUrl;
  if (item.content.type === "carousel") return item.content.slides[0]?.url ?? null;
  return null;
}

export default function ReelsFeed({
  items,
  initialId,
  backHref,
  urlPrefix,
  disableTracking = false,
  initialUpvoted,
  initialBookmarked,
  initialCompleted,
}: {
  items: FeedItem[];
  initialId: string;
  backHref: string;
  /** Per-lesson URL is built as `urlPrefix + id`. Use "/watch/" for the real
   *  feed and "/preview/<token>/watch/" for the preview surface. */
  urlPrefix: string;
  /** True in preview mode — no tracking events fire. */
  disableTracking?: boolean;
  /** Set of lesson ids the user has already upvoted. Drives the filled-ThumbsUp
   *  state for the matching lesson in the feed; empty/omitted in preview. */
  initialUpvoted?: Set<string>;
  /** Set of lesson ids the user has already bookmarked. Drives the filled-
   *  Bookmark state for the matching lesson; empty/omitted in preview. */
  initialBookmarked?: Set<string>;
  /** Set of lesson ids the user has already completed. Used to auto-advance
   *  to the next unwatched lesson after a group-completion celebration
   *  burst drains; empty/omitted in preview. */
  initialCompleted?: Set<string>;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const initialIndex = useMemo(() => {
    const i = items.findIndex((it) => it.id === initialId);
    return i >= 0 ? i : 0;
  }, [items, initialId]);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [notesOpen, setNotesOpen] = useState(false);
  // Snap state is lifted here so the shrunk video card behind the drawer
  // can track the drawer height in real time — the card's scale is a
  // function of the active snap point, keeping a constant ~2vh black
  // gap between card-bottom and drawer-top at every snap.
  const [notesSnap, setNotesSnap] = useState<number | string | null>(
    NOTES_INITIAL_SNAP,
  );
  // Celebration queue. A single lesson_completed can arrive with up to three
  // signals (tierUnlocked, groupCompleted, firstThreeComplete). We render one
  // at a time — dismissing the top pops the next — in priority order:
  // tier > group > first-three. Tier is the rarest and biggest moment, group
  // needs a rating, first-three is a small pat on the back.
  type Celebration =
    | {
        kind: "tier";
        tierId: string;
        tierName: string;
        tierEmoji: string;
        trainingComplete: boolean;
      }
    | {
        kind: "group";
        groupId: string;
        groupName: string;
        lessonCount: number;
        lessonId: string;
      }
    | { kind: "firstThree"; totalCompleted: number };
  const [celebrations, setCelebrations] = useState<Celebration[]>([]);
  const [submittingRating, setSubmittingRating] = useState(false);
  const celebration = celebrations[0] ?? null;
  const popCelebration = useCallback(
    () => setCelebrations((prev) => prev.slice(1)),
    [],
  );

  // Auto-dismiss tier/firstThree celebrations after 5s. Group is excluded
  // because it collects a rating — killing it on a timer would silently drop
  // that input; users dismiss group via Submit or the backdrop.
  useEffect(() => {
    if (!celebration) return;
    if (celebration.kind === "group") return;
    const timer = window.setTimeout(popCelebration, 5000);
    return () => window.clearTimeout(timer);
  }, [celebration, popCelebration]);

  // Completed lesson ids — hydrated from the server on mount, then augmented
  // client-side each time handleLessonCompleted fires. Drives the "next
  // unwatched" walk after a celebration burst drains.
  const [completed, setCompleted] = useState<Set<string>>(
    () => new Set(initialCompleted ?? []),
  );
  // True when the current celebration burst was seeded by a fresh
  // `groupCompleted`. Cleared when the advance fires. Ensures a lone
  // tier-only or first-three-only burst (which can fire mid-group) does
  // NOT auto-advance and rip the user out of the group they're in.
  const advancePendingRef = useRef<boolean>(false);
  // Latest activeIndex mirror — the advance effect reads this without
  // re-subscribing on every scroll.
  const activeIndexRef = useRef<number>(initialIndex);

  const handleLessonCompleted = useCallback(
    (res: LessonCompletedResponse, lessonId: string) => {
      // Optimistically mark this lesson completed so the auto-advance walk
      // doesn't scroll back to it.
      setCompleted((prev) => {
        if (prev.has(lessonId)) return prev;
        const nextSet = new Set(prev);
        nextSet.add(lessonId);
        return nextSet;
      });
      const next: Celebration[] = [];
      if (res.tierUnlocked) {
        next.push({ kind: "tier", ...res.tierUnlocked });
      }
      if (res.groupCompleted && !res.groupCompleted.alreadyRated) {
        next.push({
          kind: "group",
          groupId: res.groupCompleted.groupId,
          groupName: res.groupCompleted.groupName,
          lessonCount: res.groupCompleted.lessonCount,
          lessonId,
        });
        advancePendingRef.current = true;
      }
      if (res.firstThreeComplete) {
        next.push({
          kind: "firstThree",
          totalCompleted: res.firstThreeComplete.totalCompleted,
        });
      }
      if (next.length === 0) return;
      setCelebrations((prev) => [...prev, ...next]);
    },
    [],
  );

  const submitGroupRating = useCallback(
    async (input: { rating: GroupRating | null; comment: string }) => {
      if (!celebration || celebration.kind !== "group" || !input.rating) return;
      if (submittingRating) return;
      setSubmittingRating(true);
      try {
        await fetch(`/api/groups/${celebration.groupId}/rate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating: RATING_TO_INT[input.rating] }),
        });
        // Comment is not yet persisted server-side; it lives in the UI
        // only until the schema adds a comment column. Intentional no-op
        // for now rather than a silent 400 from the rate endpoint.
      } catch {
        // Swallow — the celebration UX should never surface a network
        // error mid-flow. Analytics can reconcile from lesson_events.
      } finally {
        setSubmittingRating(false);
        popCelebration();
      }
    },
    [celebration, submittingRating, popCelebration],
  );
  // TikTok-style gesture state. Tap = mute toggle, press-hold = pause.
  const [muted, setMuted] = useState(true);
  const [pausing, setPausing] = useState(false);
  const pressTimerRef = useRef<number | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const pressFiredRef = useRef(false);

  // Per-lesson playback progress (0..1). The active viewer reports its own
  // progress via handleProgress(lessonId, pct); inactive viewers stay frozen.
  // Scrubbing the active video flips scrubbingRef and suppresses incoming
  // onProgress for that lesson so the user-drag isn't overwritten by a stale
  // onTimeUpdate from the player.
  type SeekFn = (pct: number) => void;
  const [progressByLessonId, setProgressByLessonId] = useState<
    Record<string, number>
  >({});
  const seekRefs = useRef<Map<string, SeekFn>>(new Map());
  const scrubbingRef = useRef<string | null>(null);

  const handleProgress = useCallback((lessonId: string, pct: number) => {
    if (scrubbingRef.current === lessonId) return;
    setProgressByLessonId((prev) =>
      prev[lessonId] === pct ? prev : { ...prev, [lessonId]: pct },
    );
  }, []);

  const handleSeekReady = useCallback(
    (lessonId: string, fn: SeekFn | null) => {
      if (fn) seekRefs.current.set(lessonId, fn);
      else seekRefs.current.delete(lessonId);
    },
    [],
  );
  const [upvoted, setUpvoted] = useState<Set<string>>(
    () => new Set(initialUpvoted ?? []),
  );
  const upvotePendingRef = useRef<Set<string>>(new Set());
  const [bookmarked, setBookmarked] = useState<Set<string>>(
    () => new Set(initialBookmarked ?? []),
  );
  const bookmarkPendingRef = useRef<Set<string>>(new Set());
  // Per-lesson burst: when the user upvotes a lesson (false → true), we show
  // the UpvoteBurst overlay for ~700ms then unmount it.
  const [burstLessonId, setBurstLessonId] = useState<string | null>(null);
  const burstTimerRef = useRef<number | null>(null);

  const toggleUpvote = useCallback(
    async (lessonId: string) => {
      if (disableTracking) return;
      if (upvotePendingRef.current.has(lessonId)) return;
      upvotePendingRef.current.add(lessonId);

      const wasUpvoted = upvoted.has(lessonId);
      setUpvoted((prev) => {
        const next = new Set(prev);
        if (wasUpvoted) next.delete(lessonId);
        else next.add(lessonId);
        return next;
      });
      if (!wasUpvoted) {
        if (burstTimerRef.current !== null) {
          window.clearTimeout(burstTimerRef.current);
        }
        setBurstLessonId(lessonId);
        burstTimerRef.current = window.setTimeout(() => {
          setBurstLessonId(null);
          burstTimerRef.current = null;
        }, 1100);
      }

      try {
        const res = await fetch(`/api/lessons/${lessonId}/upvote`, {
          method: "POST",
        });
        if (!res.ok) throw new Error(`upvote failed: ${res.status}`);
        const body = (await res.json()) as { upvoted: boolean };
        setUpvoted((prev) => {
          const next = new Set(prev);
          if (body.upvoted) next.add(lessonId);
          else next.delete(lessonId);
          return next;
        });
      } catch {
        setUpvoted((prev) => {
          const next = new Set(prev);
          if (wasUpvoted) next.add(lessonId);
          else next.delete(lessonId);
          return next;
        });
      } finally {
        upvotePendingRef.current.delete(lessonId);
      }
    },
    [disableTracking, upvoted],
  );

  const toggleBookmark = useCallback(
    async (lessonId: string) => {
      if (disableTracking) return;
      if (bookmarkPendingRef.current.has(lessonId)) return;
      bookmarkPendingRef.current.add(lessonId);

      const wasBookmarked = bookmarked.has(lessonId);
      setBookmarked((prev) => {
        const next = new Set(prev);
        if (wasBookmarked) next.delete(lessonId);
        else next.add(lessonId);
        return next;
      });

      try {
        const res = await toggleBookmarkAction(lessonId);
        if ("error" in res) throw new Error(res.error);
        setBookmarked((prev) => {
          const next = new Set(prev);
          if (res.bookmarked) next.add(lessonId);
          else next.delete(lessonId);
          return next;
        });
      } catch {
        setBookmarked((prev) => {
          const next = new Set(prev);
          if (wasBookmarked) next.add(lessonId);
          else next.delete(lessonId);
          return next;
        });
      } finally {
        bookmarkPendingRef.current.delete(lessonId);
      }
    },
    [disableTracking, bookmarked],
  );

  // Scroll to the initial lesson on mount.
  useEffect(() => {
    const el = sectionRefs.current.get(items[initialIndex]?.id ?? "");
    if (el) el.scrollIntoView({ behavior: "auto", block: "start" });
    return () => {
      if (burstTimerRef.current !== null) window.clearTimeout(burstTimerRef.current);
      if (pressTimerRef.current !== null) window.clearTimeout(pressTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track which section is in view.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const obs = new IntersectionObserver(
      (entries) => {
        let best: IntersectionObserverEntry | null = null;
        for (const e of entries) {
          if (e.intersectionRatio < 0.6) continue;
          if (!best || e.intersectionRatio > best.intersectionRatio) best = e;
        }
        if (!best) return;
        const id = (best.target as HTMLElement).dataset.lessonId;
        if (!id) return;
        const idx = items.findIndex((it) => it.id === id);
        if (idx < 0) return;
        setActiveIndex(idx);
      },
      {
        root: container,
        threshold: [0.4, 0.6, 0.8, 1.0],
      },
    );
    sectionRefs.current.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [items]);

  // Sync URL with active lesson.
  useEffect(() => {
    const cur = items[activeIndex];
    if (!cur) return;
    const url = urlPrefix + cur.id;
    if (typeof window !== "undefined" && window.location.pathname !== url) {
      window.history.replaceState(window.history.state, "", url);
    }
  }, [activeIndex, items, urlPrefix]);

  // Keep activeIndexRef mirrored so the auto-advance effect below reads the
  // latest scroll position without re-subscribing on every change.
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  // Auto-advance after a celebration burst finishes draining, but only if
  // the burst was seeded by a fresh `groupCompleted`. Solo tier or
  // first-three bursts (which can fire mid-group) intentionally don't
  // advance — see docs/specs/2026-07-01-auto-advance-after-group.md.
  useEffect(() => {
    if (disableTracking) return;
    if (celebrations.length !== 0) return;
    if (!advancePendingRef.current) return;
    advancePendingRef.current = false;
    const cur = activeIndexRef.current;
    const nextIdx = nextUnwatchedIndex(items, cur, completed);
    // No unwatched left → cycle to the next lesson in scroll order (watched
    // or not) rather than eject the user to /browse. Keeps them in the feed.
    const targetIdx = nextIdx >= 0 ? nextIdx : (cur + 1) % items.length;
    const target = items[targetIdx];
    if (!target) return;
    const el = sectionRefs.current.get(target.id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [celebrations.length, completed, items, disableTracking]);

  const gotoIndex = useCallback(
    (next: number) => {
      const total = items.length;
      if (total === 0) return;
      const wrapped = ((next % total) + total) % total;
      const target = items[wrapped];
      if (!target) return;
      const el = sectionRefs.current.get(target.id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [items],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        gotoIndex(activeIndex + 1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        gotoIndex(activeIndex - 1);
      } else if (e.key === "Escape") {
        router.push(backHref);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, gotoIndex, router, backHref]);

  const PRESS_HOLD_MS = 250;
  const TAP_MOVE_PX = 12;

  function clearPressTimer() {
    if (pressTimerRef.current !== null) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }

  function isInteractive(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;
    return !!target.closest(
      'button, a, input, textarea, [role="button"], [data-no-shell-gesture]',
    );
  }

  function onShellPointerDown(e: React.PointerEvent) {
    if (isInteractive(e.target)) return;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    pressFiredRef.current = false;
    clearPressTimer();
    pressTimerRef.current = window.setTimeout(() => {
      pressFiredRef.current = true;
      setPausing(true);
    }, PRESS_HOLD_MS);
  }

  function onShellPointerMove(e: React.PointerEvent) {
    if (!pointerStartRef.current) return;
    const dx = Math.abs(e.clientX - pointerStartRef.current.x);
    const dy = Math.abs(e.clientY - pointerStartRef.current.y);
    if (dx > TAP_MOVE_PX || dy > TAP_MOVE_PX) {
      clearPressTimer();
      pointerStartRef.current = null;
      if (pressFiredRef.current) {
        setPausing(false);
        pressFiredRef.current = false;
      }
    }
  }

  function onShellPointerUp() {
    clearPressTimer();
    const wasPress = pressFiredRef.current;
    const hadPointer = pointerStartRef.current !== null;
    pressFiredRef.current = false;
    pointerStartRef.current = null;
    if (wasPress) {
      setPausing(false);
      return;
    }
    if (hadPointer) {
      setMuted((m) => !m);
    }
  }

  function onShellPointerCancel() {
    clearPressTimer();
    if (pressFiredRef.current) setPausing(false);
    pressFiredRef.current = false;
    pointerStartRef.current = null;
  }

  const current = items[activeIndex];
  const currentNotes = current?.notesMarkdown ?? null;

  return (
    <main
      className="fixed inset-0 bg-black text-white overflow-hidden touch-none select-none"
      onPointerDown={onShellPointerDown}
      onPointerMove={onShellPointerMove}
      onPointerUp={onShellPointerUp}
      onPointerCancel={onShellPointerCancel}
    >
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-y-scroll snap-y snap-mandatory overscroll-y-contain"
        style={{ touchAction: "pan-y", scrollbarWidth: "none" }}
      >
        {items.map((it, i) => {
          const active = i === activeIndex;
          const isUpvoted = upvoted.has(it.id);
          const isBookmarked = bookmarked.has(it.id);
          const hasNotes = !!(
            it.notesMarkdown && it.notesMarkdown.trim().length > 0
          );
          const glowSrc = glowSourceUrl(it);
          return (
            <section
              key={it.id}
              ref={(el) => {
                if (el) sectionRefs.current.set(it.id, el);
                else sectionRefs.current.delete(it.id);
              }}
              data-lesson-id={it.id}
              className="relative snap-start bg-black"
              style={{ height: "100dvh", width: "100%" }}
            >
              {/* GLOW LAYER — desktop only. Blurred copy of the active media
                  bleeds soft color around the card. Hidden < lg. */}
              {glowSrc && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 hidden lg:block overflow-hidden"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={glowSrc}
                    alt=""
                    className="absolute left-1/2 top-1/2 h-[110%] w-[70%] max-w-none -translate-x-1/2 -translate-y-1/2 object-cover opacity-30"
                    style={{
                      filter: "blur(140px) saturate(0.6)",
                      maskImage:
                        "radial-gradient(ellipse 60% 70% at center, black 0%, rgba(0,0,0,0.4) 45%, transparent 75%)",
                      WebkitMaskImage:
                        "radial-gradient(ellipse 60% 70% at center, black 0%, rgba(0,0,0,0.4) 45%, transparent 75%)",
                    }}
                    draggable={false}
                  />
                </div>
              )}

              {/* CENTERING LAYER — flex on lg, passthrough below. */}
              <div className="relative h-full w-full lg:flex lg:items-center lg:justify-center lg:gap-5">
                {/* CARD FRAME — full-bleed on mobile, rounded portrait card on lg.
                    When the mobile notes sheet is open, shrink the card to a
                    small preview at the top with rounded corners (Figma
                    node 96:291). Main stays full-viewport bg-black so the
                    space around the preview is dark, not the browser default. */}
                <div
                  className={cn(
                    "relative h-full w-full bg-black",
                    "lg:h-[min(90vh,880px)] lg:w-auto",
                    "lg:aspect-[9/16] lg:max-w-[80vw]",
                    "lg:overflow-hidden lg:rounded-2xl",
                    "lg:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]",
                    "lg:ring-1 lg:ring-white/10",
                    "origin-top transition-transform duration-500 ease-out will-change-transform",
                    // Rounded/overflow stays class-based; the actual scale
                    // is computed from the drawer snap point below so the
                    // card tracks the drawer height in real time.
                    notesOpen &&
                      "overflow-hidden rounded-[24px] lg:rounded-2xl",
                  )}
                  style={
                    notesOpen
                      ? {
                          // 4vh top pad + card height + 2vh gap = drawer top.
                          // drawer top = (1 - snap) * 100vh, so
                          // card height = ((1 - snap) * 100 - 4 - 2)vh
                          // and scale (of the 100vh section) = card_height / 100.
                          // Guarded to 0.02 min so the card never inverts.
                          transform: (() => {
                            const s =
                              typeof notesSnap === "number" ? notesSnap : 0.55;
                            const scale = Math.max(0.02, 1 - s - 0.06);
                            return `translateY(4vh) scale(${scale.toFixed(3)})`;
                          })(),
                        }
                      : undefined
                  }
                >
                  {it.content.type === "video" && (
                    <VideoLessonViewer
                      lessonId={it.id}
                      playbackId={it.content.playbackId}
                      title={it.title}
                      subtitlesEnabled
                      aspectRatio={it.content.aspectRatio}
                      active={active}
                      disableTracking={disableTracking}
                      muted={muted}
                      paused={active && pausing}
                      onProgress={handleProgress}
                      onSeekReady={handleSeekReady}
                      onLessonCompleted={(res) =>
                        handleLessonCompleted(res, it.id)
                      }
                    />
                  )}
                  {it.content.type === "image" && (
                    <ImageLessonViewer
                      lessonId={it.id}
                      imageUrl={it.content.imageUrl}
                      imageAlt={it.content.imageAlt}
                      aspectRatio={it.content.aspectRatio}
                      active={active}
                      disableTracking={disableTracking}
                      onProgress={handleProgress}
                      onLessonCompleted={(res) =>
                        handleLessonCompleted(res, it.id)
                      }
                    />
                  )}
                  {it.content.type === "carousel" && (
                    <CarouselLessonViewer
                      lessonId={it.id}
                      slides={it.content.slides}
                      aspectRatio={it.content.aspectRatio}
                      active={active}
                      disableTracking={disableTracking}
                      onProgress={handleProgress}
                      onLessonCompleted={(res) =>
                        handleLessonCompleted(res, it.id)
                      }
                    />
                  )}
                  {/* MUTE — desktop only, overlaid on top-right of the video
                      card. No stroke: rests on the media, softer weight. */}
                  {it.content.type === "video" && (
                    <button
                      type="button"
                      aria-label={muted ? "Unmute" : "Mute"}
                      aria-pressed={!muted}
                      data-no-shell-gesture
                      onClick={(e) => {
                        e.stopPropagation();
                        setMuted((m) => !m);
                      }}
                      className="pointer-events-auto absolute right-4 top-4 z-40 hidden h-10 w-10 items-center justify-center rounded-full bg-[rgba(14,14,14,0.45)] text-[#f9fdff] backdrop-blur-md transition-colors hover:bg-[rgba(14,14,14,0.65)] lg:flex"
                    >
                      {muted ? (
                        <VolumeX className="h-4 w-4" strokeWidth={2} />
                      ) : (
                        <Volume2 className="h-4 w-4" strokeWidth={2} />
                      )}
                    </button>
                  )}

                  {/* BOTTOM OVERLAY — per-section. Inside the card on lg,
                      full-width gradient on mobile (same as before). Title +
                      (mobile) upvote + (mobile) Learn more + progress bar.
                      Fades out when the mobile notes sheet opens so the
                      preview shows just the media. */}
                  <div
                    className={cn(
                      "pointer-events-none absolute inset-x-0 bottom-0 z-40 transition-opacity duration-300",
                      notesOpen && "opacity-0 lg:opacity-100",
                    )}
                    style={{
                      backgroundImage:
                        "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.55) 50%, rgba(0,0,0,0) 100%)",
                    }}
                  >
                    <div
                      className="flex items-end gap-2 px-6 pb-10 pt-10 lg:px-5 lg:pt-8 lg:pb-7"
                      style={{
                        paddingBottom:
                          "calc(env(safe-area-inset-bottom, 0px) + 2.5rem)",
                      }}
                    >
                      <div
                        className="flex flex-1 flex-col gap-1.5 text-[#f9fdff]"
                        style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
                      >
                        <p className="text-[18px] font-semibold leading-[1.2] text-[#f9fdff] lg:text-[15px] lg:font-medium lg:leading-[1.3]">
                          {it.title}
                        </p>
                        {it.description && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (hasNotes) setNotesOpen(true);
                            }}
                            disabled={!hasNotes}
                            className="pointer-events-auto self-start text-left text-[14px] font-normal leading-[1.35] text-[#f9fdff]/85 transition-colors hover:text-[#f9fdff] disabled:cursor-default lg:hidden"
                          >
                            <span className="line-clamp-1">
                              {it.description}
                              {hasNotes && (
                                <span className="text-[#b2b2b2]"> …</span>
                              )}
                            </span>
                          </button>
                        )}
                      </div>

                      {/* Bottom-overlay actions — mobile only, stacked with
                          bookmark on top and upvote below. Desktop's
                          upvote/mute live in the outside side rail.
                          -14px marginRight offsets the 48px hit target's
                          internal centering so the 20px glyphs sit flush
                          against the title's px-6 right edge. */}
                      <div
                        className="pointer-events-auto flex flex-col items-center gap-2 pl-2 lg:hidden"
                        style={{ marginRight: "-14px" }}
                      >
                        <button
                          type="button"
                          aria-label={
                            isBookmarked ? "Remove bookmark" : "Save lesson"
                          }
                          aria-pressed={isBookmarked}
                          onClick={(e) => {
                            e.stopPropagation();
                            void toggleBookmark(it.id);
                          }}
                          className="flex h-12 w-12 items-center justify-center text-[#f9fdff]"
                        >
                          <Bookmark
                            className={cn(
                              "h-5 w-5 transition-colors",
                              isBookmarked
                                ? "fill-arctic-haze text-arctic-haze"
                                : "",
                            )}
                            strokeWidth={2}
                          />
                        </button>
                        <button
                          type="button"
                          aria-label={isUpvoted ? "Remove upvote" : "Upvote"}
                          aria-pressed={isUpvoted}
                          onClick={(e) => {
                            e.stopPropagation();
                            void toggleUpvote(it.id);
                          }}
                          className="relative flex h-12 w-12 items-center justify-center text-[#f9fdff]"
                        >
                          <UpvoteBurst active={active && burstLessonId === it.id} />
                          <span
                            key={burstLessonId === it.id ? "bump" : "rest"}
                            className={cn(
                              "relative z-10 inline-flex",
                              burstLessonId === it.id && "upvote-bump",
                            )}
                          >
                            <ThumbsUp
                              className={cn(
                                "h-5 w-5 transition-colors",
                                isUpvoted ? "fill-arctic-haze text-arctic-haze" : "",
                              )}
                              strokeWidth={2}
                            />
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Progress bar / scrubber — video only. Reflects the
                        active lesson's currentTime/duration; an invisible
                        hit-pad above the bar makes it draggable to seek
                        without shifting the visual bar position. Images and
                        carousels have no timeline to represent, so we omit
                        the bar there entirely. */}
                    {it.content.type === "video" && (() => {
                      const pct = progressByLessonId[it.id] ?? 0;
                      const isVideoActive = active;
                      const applyScrub = (
                        e: React.PointerEvent<HTMLDivElement>,
                      ) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const next = Math.max(
                          0,
                          Math.min(1, (e.clientX - rect.left) / rect.width),
                        );
                        setProgressByLessonId((prev) => ({
                          ...prev,
                          [it.id]: next,
                        }));
                        seekRefs.current.get(it.id)?.(next);
                      };
                      const onScrubDown = (
                        e: React.PointerEvent<HTMLDivElement>,
                      ) => {
                        e.stopPropagation();
                        e.currentTarget.setPointerCapture?.(e.pointerId);
                        scrubbingRef.current = it.id;
                        applyScrub(e);
                      };
                      const onScrubMove = (
                        e: React.PointerEvent<HTMLDivElement>,
                      ) => {
                        if (scrubbingRef.current !== it.id) return;
                        e.stopPropagation();
                        applyScrub(e);
                      };
                      const onScrubEnd = (
                        e: React.PointerEvent<HTMLDivElement>,
                      ) => {
                        if (scrubbingRef.current !== it.id) return;
                        e.stopPropagation();
                        e.currentTarget.releasePointerCapture?.(e.pointerId);
                        scrubbingRef.current = null;
                      };
                      return (
                        <div className="relative h-1 w-full bg-white/12">
                          <div
                            className="absolute inset-y-0 left-0 bg-[#c1e8fb]"
                            style={{ width: `${pct * 100}%` }}
                          />
                          {isVideoActive && (
                            <div
                              data-no-shell-gesture
                              className="pointer-events-auto absolute -top-3 left-0 right-0 bottom-0 cursor-pointer touch-none select-none"
                              onPointerDown={onScrubDown}
                              onPointerMove={onScrubMove}
                              onPointerUp={onScrubEnd}
                              onPointerCancel={onScrubEnd}
                            />
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* NOTES PANEL — desktop only, sits to the right of the card
                    when the lesson has notes. Mobile surfaces the same
                    content via the "Learn more" sheet inside the overlay. */}
                {hasNotes && (
                  <aside
                    data-no-shell-gesture
                    className="pointer-events-auto hidden lg:flex lg:flex-col w-[360px] overflow-hidden rounded-2xl border border-white/10 bg-[rgba(14,14,14,0.85)] text-[#f9fdff] backdrop-blur-md shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]"
                  >
                    <div className="shrink-0 border-b border-white/8 px-6 pt-6 pb-4">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[#f9fdff]/55">
                        Notes
                      </p>
                    </div>
                    <div className="dojo-notes-scroll overflow-y-auto px-6 py-5 max-h-[80vh]">
                      {it.notesMarkdown && (
                        <NotesMarkdown>{it.notesMarkdown}</NotesMarkdown>
                      )}
                    </div>
                  </aside>
                )}

                {/* SIDE RAIL — desktop only, vertical stack immediately to
                    the right of the card (or the notes panel, when present).
                    Bookmark and upvote are strokeless icon buttons; nav
                    arrows below keep the 48px circular-stroke treatment.
                    Mute lives on top of the video, no stroke, top-right of
                    the card. */}
                <div className="pointer-events-auto hidden lg:flex flex-col gap-2">
                  <button
                    type="button"
                    aria-label={
                      isBookmarked ? "Remove bookmark" : "Save lesson"
                    }
                    aria-pressed={isBookmarked}
                    onClick={(e) => {
                      e.stopPropagation();
                      void toggleBookmark(it.id);
                    }}
                    className="flex h-12 w-12 items-center justify-center text-[#f9fdff]"
                  >
                    <Bookmark
                      className={cn(
                        "h-5 w-5 transition-colors",
                        isBookmarked
                          ? "fill-arctic-haze text-arctic-haze"
                          : "",
                      )}
                      strokeWidth={2}
                    />
                  </button>
                  <button
                    type="button"
                    aria-label={isUpvoted ? "Remove upvote" : "Upvote"}
                    aria-pressed={isUpvoted}
                    onClick={(e) => {
                      e.stopPropagation();
                      void toggleUpvote(it.id);
                    }}
                    className="relative flex h-12 w-12 items-center justify-center text-[#f9fdff]"
                  >
                    <UpvoteBurst active={active && burstLessonId === it.id} />
                    <span
                      key={burstLessonId === it.id ? "bump" : "rest"}
                      className={cn(
                        "relative z-10 inline-flex",
                        burstLessonId === it.id && "upvote-bump",
                      )}
                    >
                      <ThumbsUp
                        className={cn(
                          "h-5 w-5 transition-colors",
                          isUpvoted ? "fill-arctic-haze text-arctic-haze" : "",
                        )}
                        strokeWidth={2}
                      />
                    </span>
                  </button>
                  {items.length > 1 && (
                    <>
                      <button
                        type="button"
                        aria-label="Previous lesson"
                        onClick={(e) => {
                          e.stopPropagation();
                          gotoIndex(activeIndex - 1);
                        }}
                        className="mt-3 flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-[rgba(14,14,14,0.55)] text-[#f9fdff] backdrop-blur-md transition-colors hover:bg-[rgba(14,14,14,0.7)]"
                      >
                        <ChevronUp className="h-5 w-5" strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        aria-label="Next lesson"
                        onClick={(e) => {
                          e.stopPropagation();
                          gotoIndex(activeIndex + 1);
                        }}
                        className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-[rgba(14,14,14,0.55)] text-[#f9fdff] backdrop-blur-md transition-colors hover:bg-[rgba(14,14,14,0.7)]"
                      >
                        <ChevronDown className="h-5 w-5" strokeWidth={2} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* Persistent back button — 48px circular, never fades */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-50"
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          transform: "translateZ(0)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-20"
          style={{
            backgroundImage:
              "linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,0))",
          }}
          aria-hidden
        />
        <div className="relative flex px-6 pt-4">
          {/* -22px marginLeft = -14 (button internal centering: (48-20)/2)
              - 8 (Lucide chevron's stroke-inset from icon box). Puts the
              chevron tip flush with the title's px-6 left edge. */}
          <Link
            href={backHref}
            aria-label="Back to lessons"
            onClick={(e) => e.stopPropagation()}
            className="pointer-events-auto flex h-12 w-12 items-center justify-center text-[#f9fdff] transition-opacity hover:opacity-70"
            style={{ marginLeft: "-22px" }}
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2} />
          </Link>
        </div>
      </div>

      <VideoNotesSheet
        open={notesOpen}
        onOpenChange={setNotesOpen}
        snap={notesSnap}
        setSnap={setNotesSnap}
        notesMarkdown={currentNotes}
        lessonTitle={current?.title}
      />

      {celebration && (
        <div
          key={
            celebration.kind === "tier"
              ? `tier-${celebration.tierId}`
              : celebration.kind === "group"
                ? `group-${celebration.groupId}`
                : `first-three-${celebration.totalCompleted}`
          }
          data-no-shell-gesture
          className="fixed inset-0 z-[60] flex items-center justify-center px-6 py-12"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={popCelebration}
        >
          {/* Backdrop — dims the reel behind and swallows shell gestures.
              Clicks anywhere outside the card bubble up and dismiss; the
              card and X button call stopPropagation to opt out. */}
          <div
            aria-hidden
            className="absolute inset-0 bg-near-black/60 backdrop-blur-md"
          />
          <ConfettiBurst
            intensity={celebration.kind === "tier" ? "tier" : "lesson"}
          />
          <button
            type="button"
            aria-label="Dismiss"
            onClick={(e) => {
              e.stopPropagation();
              popCelebration();
            }}
            className="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-[rgba(14,14,14,0.55)] text-[#f9fdff] backdrop-blur-md transition-colors hover:bg-[rgba(14,14,14,0.7)]"
            style={{ top: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
          <div
            className="relative z-10 flex w-full max-w-md items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {celebration.kind === "group" && (
              <SuccessGroupCard onSubmit={submitGroupRating} />
            )}
            {celebration.kind === "firstThree" && (
              <SuccessCard
                icon={<AnimatedEmoji emoji="🎉" play className="h-10 w-10" />}
                title={
                  <>Congrats! You&apos;ve just completed your first three lessons.</>
                }
                subtitle="Keep going!"
              />
            )}
            {celebration.kind === "tier" && (
              <SuccessCard
                icon={
                  <AnimatedEmoji
                    emoji={celebration.tierEmoji}
                    play
                    className="h-10 w-10"
                  />
                }
                title={
                  <>
                    Congrats! You&apos;ve just reached {celebration.tierName}.
                  </>
                }
                subtitle={
                  celebration.trainingComplete
                    ? "That's every lesson done. Nice work."
                    : "Keep going — new lessons just opened up."
                }
              />
            )}
          </div>
        </div>
      )}

      <style>{`main > div::-webkit-scrollbar { display: none; }`}</style>
    </main>
  );
}
