"use client";

import { useEffect, useState } from "react";

/**
 * LoginIntro — 3s boot overlay for /login.
 *
 * Timeline:
 *   0.00s  #0e0e0e overlay covers the settled login state.
 *   0.20s  Pandas emblem starts drawing (GIF, inverted to white).
 *   1.20s  emblem stroke complete (native GIF timing), held.
 *   1.50s  emblem fades out. Overlay dissolves to transparent (900ms).
 *   2.20s  wizard content rises into place (staggered 60/120ms).
 *   3.00s  at rest — normal login.
 *
 * Plays on first visit per browser session. Skipped on subsequent visits
 * (sessionStorage `dojo:intro-played`) and when prefers-reduced-motion is
 * on. A tiny inline script in the login page sets a document attribute
 * BEFORE first paint so repeat visits don't flash the overlay.
 *
 * Wizard rise-in works by adding `.dojo-rise-in` to elements in the
 * wizard. The keyframes live in this component's injected <style>; when
 * the intro doesn't mount, the CSS is absent and the wizard renders at
 * full opacity with no transform — no coupling, no gating logic in the
 * wizard.
 */

export const INTRO_STORAGE_KEY = "dojo:intro-played";
export const INTRO_SKIP_ATTR = "data-dojo-intro";
const INTRO_TOTAL_MS = 3000;

export default function LoginIntro() {
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    const alreadyPlayed = (() => {
      try {
        return sessionStorage.getItem(INTRO_STORAGE_KEY) === "1";
      } catch {
        return false;
      }
    })();
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (alreadyPlayed || reduced) {
      // Belt-and-braces: the inline script in page.tsx should already have
      // set the skip attribute before paint. Set it here too in case that
      // script didn't run (private-mode sessionStorage throws) or reduced-
      // motion is the reason we're skipping.
      document.documentElement.setAttribute(INTRO_SKIP_ATTR, "skip");
      setMounted(false);
      return;
    }

    const t = window.setTimeout(() => {
      try {
        sessionStorage.setItem(INTRO_STORAGE_KEY, "1");
      } catch {
        // Private mode etc. — flag lost, intro will replay next time.
      }
      setMounted(false);
    }, INTRO_TOTAL_MS);
    return () => window.clearTimeout(t);
  }, []);

  if (!mounted) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: INTRO_STYLES }} />
      <div
        aria-hidden
        className="dojo-intro-overlay pointer-events-none fixed inset-0 z-50 bg-[#0e0e0e]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- animated GIF; Next Image doesn't handle GIFs */}
        <img
          src="/brand/pandas-emblem-animated.gif"
          alt=""
          aria-hidden
          draggable={false}
          className="dojo-intro-emblem absolute left-1/2 top-[46%] select-none"
          style={{ width: 160, filter: "invert(1) brightness(1.05)" }}
        />
      </div>
    </>
  );
}

const INTRO_STYLES = `
@keyframes dojo-intro-overlay-fade {
  0%, 50%   { opacity: 1; }
  80%, 100% { opacity: 0; }
}
@keyframes dojo-intro-emblem-pulse {
  0%    { opacity: 0; transform: translate(-50%, -50%) scale(0.98); }
  6.7%  { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  50%   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  73.3%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(1.02); }
}
@keyframes dojo-intro-rise {
  0%, 73.3% { opacity: 0; transform: translateY(12px); }
  90%, 100% { opacity: 1; transform: translateY(0); }
}
.dojo-intro-overlay {
  animation: dojo-intro-overlay-fade 3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.dojo-intro-emblem {
  transform: translate(-50%, -50%) scale(0.98);
  opacity: 0;
  animation: dojo-intro-emblem-pulse 3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
.dojo-rise-in {
  opacity: 0;
  animation: dojo-intro-rise 3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.dojo-rise-in--delay-1 { animation-delay: 60ms; }
.dojo-rise-in--delay-2 { animation-delay: 120ms; }
[${INTRO_SKIP_ATTR}="skip"] .dojo-intro-overlay { display: none; }
[${INTRO_SKIP_ATTR}="skip"] .dojo-rise-in {
  animation: none !important;
  opacity: 1 !important;
  transform: none !important;
}
`;
