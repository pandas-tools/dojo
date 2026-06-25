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

  const currentSegment = step === "language" ? 1 : step === "store" ? 2 : 3;
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

  return (
    <div className="w-full">
      <div className="mb-7">
        <StepProgress current={currentSegment} total={3} />
      </div>

      <div className="relative">
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
                onNext={() => setStep("store")}
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
                onBack={() => setStep("language")}
                onSubmit={handleSubmit}
                submitting={pending}
                error={error}
                submitLabel={submitLabel}
              />
            </motion.div>
          )}

          {step === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={TRANSITION}
            >
              <AllSetStep mode={mode} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
