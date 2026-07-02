"use client";

import Lottie, { type LottieRefCurrentProps } from "lottie-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * AnimatedEmoji — renders a Noto animated emoji (Google's noto-emoji-animation
 * set). Maps `emoji` → codepoint → self-hosted Lottie JSON in /public/emoji/.
 * Plays on loop when `play` is true; frozen at frame 0 otherwise (still visible,
 * just static). Respects prefers-reduced-motion. Falls back to the raw text
 * glyph if the JSON is missing so we never blank.
 */

// Module-level cache so multiple sites don't refetch the same emoji's JSON.
const CACHE = new Map<string, object | "missing">();

function codepointOf(emoji: string): string {
  return emoji.codePointAt(0)?.toString(16) ?? "";
}

export default function AnimatedEmoji({
  emoji,
  play = false,
  className,
}: {
  emoji: string;
  play?: boolean;
  className?: string;
}) {
  const codepoint = codepointOf(emoji);
  const [data, setData] = useState<object | null>(() => {
    const cached = CACHE.get(codepoint);
    return cached && cached !== "missing" ? (cached as object) : null;
  });
  const [missing, setMissing] = useState(
    () => CACHE.get(codepoint) === "missing",
  );
  const [reduced, setReduced] = useState(false);
  const ref = useRef<LottieRefCurrentProps>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (data || missing || !codepoint) return;
    let alive = true;
    fetch(`/emoji/${codepoint}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((json) => {
        CACHE.set(codepoint, json);
        if (alive) setData(json);
      })
      .catch(() => {
        CACHE.set(codepoint, "missing");
        if (alive) setMissing(true);
      });
    return () => {
      alive = false;
    };
  }, [codepoint, data, missing]);

  const shouldLoop = play && !reduced;

  useEffect(() => {
    const inst = ref.current;
    if (!inst || !data) return;
    if (shouldLoop) inst.play();
    else inst.goToAndStop(0, true);
  }, [shouldLoop, data]);

  if (missing || !codepoint) {
    return (
      <span
        className={cn("inline-flex items-center justify-center", className)}
        aria-hidden
      >
        {emoji}
      </span>
    );
  }

  if (!data) {
    return <span className={cn("inline-block", className)} aria-hidden />;
  }

  return (
    <Lottie
      lottieRef={ref}
      animationData={data}
      loop={shouldLoop}
      autoplay={shouldLoop}
      className={className}
      aria-hidden
    />
  );
}
