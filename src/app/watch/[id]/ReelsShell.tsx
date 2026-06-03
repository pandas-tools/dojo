"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/cn";

const OVERLAY_AUTO_FADE_MS = 3000;

export default function ReelsShell({
  backHref,
  title,
  description,
  children,
}: {
  backHref: string;
  title: string;
  description: string | null;
  children: ReactNode;
}) {
  const [overlayVisible, setOverlayVisible] = useState(true);
  const timerRef = useRef<number | null>(null);

  function armFade() {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setOverlayVisible(false);
    }, OVERLAY_AUTO_FADE_MS);
  }

  useEffect(() => {
    armFade();
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onTap() {
    setOverlayVisible((v) => {
      const next = !v;
      if (next) armFade();
      return next;
    });
  }

  return (
    <main className="fixed inset-0 bg-black text-white overflow-hidden touch-none select-none">
      <div
        onClick={onTap}
        className="absolute inset-0 z-0 flex items-center justify-center"
      >
        {children}
      </div>

      {/* Bottom overlay — title + description inline. Gradient lives on
          the outer fixed element directly (no inner absolute child) so it
          paints with the same compositor pass as the text — the previous
          structure left the gradient + text painting BEHIND the mux-player
          video layer despite z-50. */}
      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-0 z-50 transition-opacity duration-300",
          "bg-gradient-to-t from-black via-black/70 to-transparent",
          "px-5 pt-16",
          overlayVisible ? "opacity-100" : "opacity-0",
        )}
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)",
          transform: "translateZ(0)",
          willChange: "opacity",
        }}
      >
        <p className="max-w-2xl text-[15px] leading-snug drop-shadow-md">
          <span className="font-semibold">{title}</span>
          {description && (
            <>
              <span className="mx-1.5 text-white/70">·</span>
              <span className="text-white/90">{description}</span>
            </>
          )}
        </p>
      </div>

      {/* Persistent back button — never fades. Same GPU-layer trick as the
          bottom overlay so it isn't drawn under the mux-player video stack. */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-50"
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          transform: "translateZ(0)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/55 to-transparent"
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
    </main>
  );
}
