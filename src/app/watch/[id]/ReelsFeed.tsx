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
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Heart,
  BookOpen,
  Volume2,
  VolumeX,
} from "lucide-react";
import VideoNotesSheet from "@/components/VideoNotesSheet";
import UpvoteBurst from "@/components/UpvoteBurst";
import { cn } from "@/lib/cn";
import type { CarouselSlide } from "@/lib/db/schema";
import VideoLessonViewer from "./VideoLessonViewer";
import ImageLessonViewer from "./ImageLessonViewer";
import CarouselLessonViewer from "./CarouselLessonViewer";

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
}: {
  items: FeedItem[];
  initialId: string;
  backHref: string;
  /** Per-lesson URL is built as `urlPrefix + id`. Use "/watch/" for the real
   *  feed and "/preview/<token>/watch/" for the preview surface. */
  urlPrefix: string;
  /** True in preview mode — no tracking events fire. */
  disableTracking?: boolean;
  /** Set of lesson ids the user has already upvoted. Drives the filled-Heart
   *  state for the matching lesson in the feed; empty/omitted in preview. */
  initialUpvoted?: Set<string>;
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
  // TikTok-style gesture state. Tap = mute toggle, press-hold = pause.
  const [muted, setMuted] = useState(true);
  const [pausing, setPausing] = useState(false);
  const pressTimerRef = useRef<number | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const pressFiredRef = useRef(false);
  const [upvoted, setUpvoted] = useState<Set<string>>(
    () => new Set(initialUpvoted ?? []),
  );
  const upvotePendingRef = useRef<Set<string>>(new Set());
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
                {/* CARD FRAME — full-bleed on mobile, rounded portrait card on lg. */}
                <div
                  className={cn(
                    "relative h-full w-full bg-black",
                    "lg:h-auto lg:w-auto",
                    "lg:aspect-[9/16] lg:max-h-[min(90vh,880px)] lg:max-w-[80vw]",
                    "lg:overflow-hidden lg:rounded-2xl",
                    "lg:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]",
                    "lg:ring-1 lg:ring-white/10",
                  )}
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
                    />
                  )}
                  {it.content.type === "carousel" && (
                    <CarouselLessonViewer
                      lessonId={it.id}
                      slides={it.content.slides}
                      aspectRatio={it.content.aspectRatio}
                      active={active}
                      disableTracking={disableTracking}
                    />
                  )}
                  <UpvoteBurst active={active && burstLessonId === it.id} />

                  {/* BOTTOM OVERLAY — per-section. Inside the card on lg,
                      full-width gradient on mobile (same as before). Title +
                      description + (mobile) Heart + (mobile) Learn more +
                      progress bar. */}
                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 z-40"
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
                        <p className="leading-[1.3]">
                          <span className="text-[22px] font-medium text-[#f9fdff] lg:text-[15px]">
                            {it.title}
                          </span>
                          {it.description && (
                            <span className="text-[13px] text-[#b2b2b2] lg:text-[12px]">
                              {" "}
                              {it.description}
                            </span>
                          )}
                        </p>
                        {hasNotes && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setNotesOpen(true);
                            }}
                            className="self-start text-[11px] leading-[1.3] text-[#b2b2b2] underline underline-offset-2 transition-colors hover:text-[#f9fdff] lg:hidden"
                          >
                            Learn more
                          </button>
                        )}
                      </div>

                      {/* Mobile-only Heart (right column). On lg the rail
                          outside the card owns this affordance. */}
                      <div className="pointer-events-auto flex flex-col items-center gap-4 pl-2 lg:hidden">
                        <button
                          type="button"
                          aria-label={isUpvoted ? "Remove upvote" : "Upvote"}
                          aria-pressed={isUpvoted}
                          onClick={(e) => {
                            e.stopPropagation();
                            void toggleUpvote(it.id);
                          }}
                          className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-[rgba(14,14,14,0.55)] text-[#f9fdff] backdrop-blur-md transition-colors hover:bg-[rgba(14,14,14,0.7)]"
                        >
                          <Heart
                            className={cn(
                              "h-5 w-5 transition-colors",
                              isUpvoted ? "fill-arctic-haze text-arctic-haze" : "",
                            )}
                            strokeWidth={2}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Progress bar — bottom edge of the card on lg, bottom
                        edge of the viewport on mobile (same node either way). */}
                    <div className="h-1 w-full bg-white/12">
                      <div
                        className="h-full bg-[#c1e8fb] transition-[width] duration-300 ease-out"
                        style={{
                          width: `${
                            items.length > 0
                              ? ((activeIndex + 1) / items.length) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* SIDE RAIL — desktop only, vertical stack to the right of the
                    card. Heart + (optional) Notes + (video) Mute. */}
                <div className="pointer-events-auto hidden lg:flex flex-col items-center gap-3 pl-1">
                  <button
                    type="button"
                    aria-label={isUpvoted ? "Remove upvote" : "Upvote"}
                    aria-pressed={isUpvoted}
                    onClick={(e) => {
                      e.stopPropagation();
                      void toggleUpvote(it.id);
                    }}
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-[rgba(14,14,14,0.55)] text-[#f9fdff] backdrop-blur-md transition-colors hover:bg-[rgba(14,14,14,0.7)]"
                  >
                    <Heart
                      className={cn(
                        "h-5 w-5 transition-colors",
                        isUpvoted ? "fill-arctic-haze text-arctic-haze" : "",
                      )}
                      strokeWidth={2}
                    />
                  </button>
                  {hasNotes && (
                    <button
                      type="button"
                      aria-label="Open lesson notes"
                      onClick={(e) => {
                        e.stopPropagation();
                        setNotesOpen(true);
                      }}
                      className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-[rgba(14,14,14,0.55)] text-[#f9fdff] backdrop-blur-md transition-colors hover:bg-[rgba(14,14,14,0.7)]"
                    >
                      <BookOpen className="h-5 w-5" strokeWidth={2} />
                    </button>
                  )}
                  {it.content.type === "video" && (
                    <button
                      type="button"
                      aria-label={muted ? "Unmute" : "Mute"}
                      aria-pressed={!muted}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMuted((m) => !m);
                      }}
                      className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-[rgba(14,14,14,0.55)] text-[#f9fdff] backdrop-blur-md transition-colors hover:bg-[rgba(14,14,14,0.7)]"
                    >
                      {muted ? (
                        <VolumeX className="h-5 w-5" strokeWidth={2} />
                      ) : (
                        <Volume2 className="h-5 w-5" strokeWidth={2} />
                      )}
                    </button>
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
          <Link
            href={backHref}
            aria-label="Back to lessons"
            onClick={(e) => e.stopPropagation()}
            className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-[rgba(14,14,14,0.55)] text-[#f9fdff] backdrop-blur-md transition-colors hover:bg-[rgba(14,14,14,0.7)]"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2} />
          </Link>
        </div>
      </div>

      {/* Desktop-only vertical arrow controls */}
      {items.length > 1 && (
        <div className="pointer-events-none fixed right-3 top-1/2 -translate-y-1/2 z-50 hidden sm:flex flex-col gap-2">
          <button
            type="button"
            aria-label="Previous lesson"
            onClick={(e) => {
              e.stopPropagation();
              gotoIndex(activeIndex - 1);
            }}
            className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/55 backdrop-blur text-white hover:bg-black/70 transition-colors"
          >
            <ChevronUp className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Next lesson"
            onClick={(e) => {
              e.stopPropagation();
              gotoIndex(activeIndex + 1);
            }}
            className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/55 backdrop-blur text-white hover:bg-black/70 transition-colors"
          >
            <ChevronDown className="h-5 w-5" />
          </button>
        </div>
      )}

      <VideoNotesSheet
        open={notesOpen}
        onOpenChange={setNotesOpen}
        notesMarkdown={currentNotes}
        lessonTitle={current?.title}
      />

      <style>{`main > div::-webkit-scrollbar { display: none; }`}</style>
    </main>
  );
}
