"use client";

import { useState } from "react";
import AuthAtmosphere from "@/components/AuthAtmosphere";

/**
 * Design preview — login intro (3s).
 *
 * Timeline:
 *   0.00s  full-viewport #0e0e0e overlay covers the settled login state.
 *   0.20s  Pandas emblem starts drawing (GIF, filter: invert(1) for white).
 *   1.20s  emblem stroke complete (native GIF timing), held.
 *   1.50s  emblem fades out (700ms). Overlay fades to transparent (900ms).
 *          Underlying gradient (AuthAtmosphere) is revealed by the fade.
 *   2.20s  wizard content rises into place (500ms).
 *   3.00s  at rest — real /login state.
 *
 * Preview only. The real integration will live in a separate LoginIntro
 * client component wired into /login itself.
 */
export default function LoginIntroPreview() {
  const [runKey, setRunKey] = useState(0);

  return (
    <main
      key={runKey}
      className="relative isolate min-h-dvh overflow-hidden bg-near-black text-white"
    >
      <AuthAtmosphere />
      <MockWizard />
      <IntroOverlay />
      <ReplayButton onClick={() => setRunKey((n) => n + 1)} />

      <style
        dangerouslySetInnerHTML={{
          __html: `
@keyframes lipOverlayFade {
  0%, 50% { opacity: 1; }
  80%, 100% { opacity: 0; }
}
@keyframes lipEmblemPulse {
  0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.98); }
  6.7% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  50%  { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  73.3%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(1.02); }
}
@keyframes lipWizardRise {
  0%, 73.3% { opacity: 0; transform: translateY(12px); }
  90%, 100% { opacity: 1; transform: translateY(0); }
}
@keyframes lipWizardCenterRise {
  0%, 73.3% { opacity: 0; transform: translate(-50%, calc(-50% + 12px)); }
  90%, 100% { opacity: 1; transform: translate(-50%, -50%); }
}
`,
        }}
      />
    </main>
  );
}

function IntroOverlay() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 bg-[#0e0e0e]"
      style={{
        animation:
          "lipOverlayFade 3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      }}
    >
      <img
        src="/brand/pandas-emblem-animated.gif"
        alt=""
        aria-hidden
        draggable={false}
        className="absolute left-1/2 top-[46%] select-none"
        style={{
          width: 160,
          filter: "invert(1) brightness(1.05)",
          transform: "translate(-50%, -50%) scale(0.98)",
          opacity: 0,
          animation:
            "lipEmblemPulse 3s cubic-bezier(0.4, 0, 0.2, 1) forwards",
        }}
      />
    </div>
  );
}

/**
 * MockWizard — visual stand-in for PreLoginWizard's "email" step, so the
 * intro's rise-in choreography reads against the real settled layout.
 */
function MockWizard() {
  const risingBase = {
    opacity: 0,
    animationName: "lipWizardRise",
    animationDuration: "3s",
    animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
    animationFillMode: "forwards" as const,
  };

  return (
    <div className="relative z-10 mx-auto h-dvh w-full max-w-[402px]">
      <div
        className="absolute left-0 right-0 top-[13.3%] flex flex-col items-center gap-10 px-6"
        style={risingBase}
      >
        <div className="flex gap-2">
          <span className="h-1.5 w-8 rounded-full bg-[#f9fdff]" />
          <span className="h-1.5 w-8 rounded-full bg-[#f9fdff]/25" />
          <span className="h-1.5 w-8 rounded-full bg-[#f9fdff]/25" />
        </div>
        <div className="w-full max-w-[327px] space-y-2 text-center">
          <h1 className="text-balance text-[24px] font-medium leading-[1.2] tracking-tight text-[#f9fdff]">
            Hi, Welcome Back!
          </h1>
          <p className="text-balance text-[14px] font-medium leading-[22px] tracking-[0.07px] text-[#f9fdff]/85">
            Sign in to keep training on Pandas Vision AI.
          </p>
        </div>
      </div>

      <div
        className="absolute left-1/2 top-1/2 w-[327px]"
        style={{
          opacity: 0,
          animation:
            "lipWizardCenterRise 3s cubic-bezier(0.16, 1, 0.3, 1) 0.06s forwards",
        }}
      >
        <input
          type="email"
          disabled
          placeholder="andylexian22@orange.com"
          className="block h-[52px] w-full rounded-[24px] border border-[#c1e8fb] bg-[rgba(68,81,88,0.1)] px-4 text-[16px] leading-[1.3] text-[#fefefe] backdrop-blur-md placeholder:text-[#8e8e8e]"
        />
      </div>

      <div
        className="absolute left-0 right-0 top-[86%] px-6"
        style={{ ...risingBase, animationDelay: "0.12s" }}
      >
        <button
          type="button"
          disabled
          className="flex h-[56px] w-full items-center justify-center rounded-[40px] bg-[#0e0e0e] px-8 text-[16px] font-normal leading-[1.3] text-[#fefefe]"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function ReplayButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-6 right-6 z-[60] rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-medium text-white/90 backdrop-blur-md transition-all duration-200 hover:border-arctic-haze/40 hover:bg-white/15"
    >
      ↻ Replay intro
    </button>
  );
}
