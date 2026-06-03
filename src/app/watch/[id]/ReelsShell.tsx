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

      {/* Bottom overlay — title + description inline. Lives above the
          mux-player web component (which creates its own stacking via the
          shadow DOM); pinned to z-50 so it sits in the same band as the
          persistent back button. */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 z-50 flex items-end transition-opacity duration-300",
          "h-56 px-5",
          overlayVisible ? "opacity-100" : "opacity-0",
        )}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent"
          aria-hidden
        />
        <p className="relative z-10 max-w-2xl text-[15px] leading-snug drop-shadow-md">
          <span className="font-semibold">{title}</span>
          {description && (
            <>
              <span className="mx-1.5 text-white/70">·</span>
              <span className="text-white/90">{description}</span>
            </>
          )}
        </p>
      </div>

      {/* Persistent back button — never fades */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-50"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
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
