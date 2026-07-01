"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import AuthAtmosphere from "@/components/AuthAtmosphere";

/**
 * Design preview — login intro (4s).
 *
 * Timeline:
 *   0.00s  full-viewport #0e0e0e overlay covers the settled login state.
 *   0.20s  Pandas emblem starts drawing (GIF, filter: invert(1) for white).
 *   2.30s  emblem stroke complete, held.
 *   2.50s  emblem fades out (700ms). Overlay fades to transparent (900ms).
 *          Underlying gradient (AuthAtmosphere) is revealed by the fade.
 *   3.20s  wizard content rises into place (500ms, cubic-bezier .16,1,.3,1).
 *   4.00s  at rest — real /login state.
 *
 * Not the production integration — this route just plays the sequence so
 * we can see the timing before wiring the real LoginIntro into /login.
 */
const T = {
  emblemInDelay: 0.2,
  emblemOutStart: 2.5,
  emblemOutDur: 0.7,
  overlayFadeStart: 2.5,
  overlayFadeDur: 0.9,
  wizardRiseStart: 3.2,
  wizardRiseDur: 0.5,
} as const;

const EASE = [0.16, 1, 0.3, 1] as const;

export default function LoginIntroPreview() {
  const [runKey, setRunKey] = useState(0);

  return (
    <main className="relative isolate min-h-dvh overflow-hidden bg-near-black text-white">
      <AuthAtmosphere />
      <MockWizard key={`wiz-${runKey}`} />
      <IntroOverlay key={`intro-${runKey}`} />
      <ReplayButton onClick={() => setRunKey((n) => n + 1)} />
    </main>
  );
}

function IntroOverlay() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const total = (T.overlayFadeStart + T.overlayFadeDur) * 1000;
    const t = window.setTimeout(() => setVisible(false), total + 50);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-50 bg-[#0e0e0e]"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{
            duration: T.overlayFadeDur,
            delay: T.overlayFadeStart,
            ease: EASE,
          }}
        >
          <motion.img
            src="/brand/pandas-emblem-animated.gif"
            alt=""
            aria-hidden
            draggable={false}
            className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 select-none"
            style={{ width: 160, filter: "invert(1) brightness(1.05)" }}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{
              opacity: [0, 1, 1, 0],
              scale: [0.98, 1, 1, 1.02],
            }}
            transition={{
              times: [0, 0.05, 0.625, 0.8],
              duration: T.emblemOutStart + T.emblemOutDur,
              delay: T.emblemInDelay,
              ease: "easeInOut",
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * MockWizard — visual stand-in for PreLoginWizard's "email" step, so the
 * intro's rise-in choreography reads against the real settled layout.
 */
function MockWizard() {
  const rise = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: T.wizardRiseDur,
      delay: T.wizardRiseStart,
      ease: EASE,
    },
  };

  return (
    <div className="relative z-10 mx-auto h-dvh w-full max-w-[402px]">
      <motion.div
        {...rise}
        className="absolute left-0 right-0 top-[13.3%] flex flex-col items-center gap-10 px-6"
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
      </motion.div>

      <motion.div
        {...rise}
        transition={{ ...rise.transition, delay: T.wizardRiseStart + 0.06 }}
        className="absolute left-1/2 top-1/2 w-[327px] -translate-x-1/2 -translate-y-1/2"
      >
        <input
          type="email"
          disabled
          placeholder="andylexian22@orange.com"
          className="block h-[52px] w-full rounded-[24px] border border-[#c1e8fb] bg-[rgba(68,81,88,0.1)] px-4 text-[16px] leading-[1.3] text-[#fefefe] backdrop-blur-md placeholder:text-[#8e8e8e]"
        />
      </motion.div>

      <motion.div
        {...rise}
        transition={{ ...rise.transition, delay: T.wizardRiseStart + 0.12 }}
        className="absolute left-0 right-0 top-[86%] px-6"
      >
        <button
          type="button"
          disabled
          className="flex h-[56px] w-full items-center justify-center rounded-[40px] bg-[#0e0e0e] px-8 text-[16px] font-normal leading-[1.3] text-[#fefefe]"
        >
          Continue
        </button>
      </motion.div>
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
