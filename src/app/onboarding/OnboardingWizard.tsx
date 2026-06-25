"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import StepProgress from "@/components/StepProgress";
import { completeOnboarding } from "./actions";
import LanguageStep from "./steps/LanguageStep";
import StoreStep from "./steps/StoreStep";
import AllSetStep from "./steps/AllSetStep";

type StoreRow = { id: string; name: string; city: string | null };
type Step = "language" | "store" | "done";

const TRANSITION = { duration: 0.4, ease: [0.25, 1, 0.5, 1] } as const;

const STEP_TITLE: Record<Exclude<Step, "done">, string> = {
  language: "Select your Language",
  store: "Select your Store",
};

export default function OnboardingWizard({
  stores,
  languages,
  initialLanguage,
  initialStoreId,
  mode,
}: {
  stores: StoreRow[];
  languages: string[];
  initialLanguage: string;
  initialStoreId: string | null;
  mode: "first" | "reconfirm";
}) {
  const [step, setStep] = useState<Step>("language");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const defaultLanguage = languages.includes(initialLanguage)
    ? initialLanguage
    : (languages[0] ?? "en");
  const [language, setLanguage] = useState(defaultLanguage);

  const initialIsHq = mode === "reconfirm" && initialStoreId === null;
  const [hq, setHq] = useState(initialIsHq);
  const [storeId, setStoreId] = useState<string>(
    initialStoreId ?? stores[0]?.id ?? "",
  );

  const currentSegment = step === "language" ? 2 : 3;
  const submitLabel = mode === "reconfirm" ? "Confirm" : "Finish";

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const res = await completeOnboarding({
        language,
        storeId: hq ? null : storeId,
      });
      if (res?.error) {
        setError(res.error);
        return;
      }
      setStep("done");
    });
  }

  if (step === "done") {
    return (
      <div className="relative z-10 mx-auto h-dvh w-full max-w-[402px]">
        <div className="absolute left-1/2 top-1/2 w-[327px] -translate-x-1/2 -translate-y-1/2">
          <AllSetStep mode={mode} />
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-10 mx-auto h-dvh w-full max-w-[402px]">
      {/* HEADER — top 13.3% */}
      <div className="absolute left-0 right-0 top-[13.3%] flex flex-col items-center gap-10 px-6">
        <StepProgress current={currentSegment} total={3} />
        <h1 className="text-center text-[24px] font-medium leading-[1.2] tracking-tight text-[#f9fdff]">
          {STEP_TITLE[step]}
        </h1>
      </div>

      {/* CONTENT — vertically centered, 327px wide */}
      <div className="absolute left-1/2 top-1/2 w-[327px] -translate-x-1/2 -translate-y-1/2">
        <AnimatePresence mode="wait" initial={false}>
          {step === "language" && (
            <motion.div
              key="language"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={TRANSITION}
            >
              <LanguageStep
                languages={languages}
                value={language}
                onChange={setLanguage}
              />
            </motion.div>
          )}

          {step === "store" && (
            <motion.div
              key="store"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={TRANSITION}
            >
              <StoreStep
                stores={stores}
                storeId={storeId}
                hq={hq}
                onStoreChange={setStoreId}
                onHqChange={setHq}
                error={error}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CTA — bottom 14% (top-752 of 874) */}
      <div className="absolute left-0 right-0 top-[86%] flex items-center gap-2 px-6">
        <BackButton
          onClick={() =>
            step === "store" ? setStep("language") : undefined
          }
          disabled={pending || step === "language"}
        />
        <button
          type="button"
          onClick={() =>
            step === "language" ? setStep("store") : handleSubmit()
          }
          disabled={
            pending ||
            (step === "language" && !language) ||
            (step === "store" && !hq && !storeId)
          }
          className="flex h-[56px] flex-1 items-center justify-center rounded-[40px] bg-[#0e0e0e] px-8 text-[16px] font-normal leading-[1.3] text-[#fefefe] transition-colors duration-200 hover:bg-[#1a1a1a] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Saving…" : step === "language" ? "Continue" : submitLabel}
        </button>
      </div>
    </div>
  );
}

function BackButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Back"
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#445158] bg-[rgba(68,81,88,0.1)] text-[#fefefe] transition-all duration-200 hover:bg-[rgba(68,81,88,0.2)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
  );
}
