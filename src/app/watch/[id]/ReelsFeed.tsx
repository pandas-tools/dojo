"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

const OVERLAY_AUTO_FADE_MS = 3000;

export type FeedItem = {
  /** Lesson id — drives the URL. */
  id: string;
  title: string;
  description: string | null;
  /** Rendered viewer for this lesson — pre-built server-side, accepts an `active` prop via cloneElement. */
  node: ReactNode;
};

export default function ReelsFeed({
  items,
  initialId,
  backHref,
  buildHref,
}: {
  items: FeedItem[];
  initialId: string;
  backHref: string;
  /** Maps a lesson id to its canonical URL (so /watch and /preview can share the feed). */
  buildHref: (id: string) => string;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const initialIndex = useMemo(() => {
    const i = items.findIndex((it) => it.id === initialId);
    return i >= 0 ? i : 0;
  }, [items, initialId]);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const fadeTimerRef = useRef<number | null>(null);

  function armFade() {
    if (fadeTimerRef.current !== null) window.clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = window.setTimeout(() => {
      setOverlayVisible(false);
    }, OVERLAY_AUTO_FADE_MS);
  }

  // Scroll to the initial lesson on mount (no smooth so we don't visibly
  // animate INTO the chosen one — it should just be there).
  useEffect(() => {
    const el = sectionRefs.current.get(items[initialIndex]?.id ?? "");
    if (el) el.scrollIntoView({ behavior: "auto", block: "start" });
    armFade();
    return () => {
      if (fadeTimerRef.current !== null) window.clearTimeout(fadeTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track which section is in view via IntersectionObserver.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const obs = new IntersectionObserver(
      (entries) => {
        // Pick the entry with the largest intersection ratio that's ≥ 0.6.
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
        setOverlayVisible(true);
        armFade();
      },
      {
        root: container,
        threshold: [0.4, 0.6, 0.8, 1.0],
      },
    );
    sectionRefs.current.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // Sync URL with active lesson (replaceState — no history pollution as you
  // scroll, but back-button still works because the initial entry stays).
  useEffect(() => {
    const cur = items[activeIndex];
    if (!cur) return;
    const url = buildHref(cur.id);
    if (typeof window !== "undefined" && window.location.pathname !== url) {
      window.history.replaceState(window.history.state, "", url);
    }
  }, [activeIndex, items, buildHref]);

  // Keyboard nav — same shape as before
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, items, router, backHref]);

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

  function onShellTap() {
    setOverlayVisible((v) => {
      const next = !v;
      if (next) armFade();
      return next;
    });
  }

  const current = items[activeIndex];

  return (
    <main className="fixed inset-0 bg-black text-white overflow-hidden touch-none select-none">
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-y-scroll snap-y snap-mandatory overscroll-y-contain"
        style={{ touchAction: "pan-y", scrollbarWidth: "none" }}
      >
        {items.map((it, i) => (
          <section
            key={it.id}
            ref={(el) => {
              if (el) sectionRefs.current.set(it.id, el);
              else sectionRefs.current.delete(it.id);
            }}
            data-lesson-id={it.id}
            onClick={onShellTap}
            className="relative snap-start flex items-center justify-center bg-black"
            style={{ height: "100dvh", width: "100%" }}
          >
            {/* Active flag is passed to the viewer node via data attribute; the
                Active wrapper component below reads it and forwards as props. */}
            <ActiveContext.Provider value={i === activeIndex}>
              {it.node}
            </ActiveContext.Provider>
          </section>
        ))}
      </div>

      {/* Bottom overlay — title + description for the currently active lesson */}
      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-0 z-50 transition-opacity duration-300",
          "px-5 pt-16",
          overlayVisible ? "opacity-100" : "opacity-0",
        )}
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)",
          backgroundImage:
            "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.65) 40%, rgba(0,0,0,0) 100%)",
          transform: "translateZ(0)",
          willChange: "opacity",
        }}
      >
        <p
          className="max-w-2xl text-[15px] leading-snug"
          style={{ textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}
        >
          <span className="font-semibold">{current?.title}</span>
          {current?.description && (
            <>
              <span className="mx-1.5 text-white/70">·</span>
              <span className="text-white/90">{current.description}</span>
            </>
          )}
        </p>
      </div>

      {/* Persistent back button — never fades. */}
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
              "linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0))",
          }}
          aria-hidden
        />
        <div className="relative px-4 pt-3">
          <Link
            href={backHref}
            aria-label="Back to lessons"
            onClick={(e) => e.stopPropagation()}
            className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/55 backdrop-blur transition-colors hover:bg-black/70"
          >
            <ChevronLeft className="h-5 w-5 text-white" />
          </Link>
        </div>
      </div>

      {/* Desktop-only vertical arrow controls — hidden on touch devices */}
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

      <style>{`
        main > div::-webkit-scrollbar { display: none; }
      `}</style>
    </main>
  );
}

// --------------------------- ActiveContext --------------------------------

import { createContext, useContext } from "react";

const ActiveContext = createContext<boolean>(false);

/** Wrap a viewer in <ActiveAware> to receive the active flag and forward it
 *  via the `active` render-prop. Used by the page-level builders to thread
 *  the activeness down into video/image/carousel viewers without each
 *  viewer subscribing to the context directly. */
export function ActiveAware({
  children,
}: {
  children: (active: boolean) => ReactNode;
}) {
  const active = useContext(ActiveContext);
  return <>{children(active)}</>;
}
