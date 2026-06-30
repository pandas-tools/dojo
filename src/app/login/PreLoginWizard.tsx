"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/cn";
import StepProgress from "@/components/StepProgress";
import LanguageStep from "@/app/onboarding/steps/LanguageStep";
import StoreStep from "@/app/onboarding/steps/StoreStep";
import { signInWithEmail } from "./actions";

type StoreRow = { id: string; name: string; city: string | null };
type Step = "email" | "store" | "language" | "sent";

const TRANSITION = { duration: 0.4, ease: [0.25, 1, 0.5, 1] } as const;

const PRELOGIN_KEY = "dojo:pending-onboarding";

/**
 * PreLoginWizard — 3 pre-auth steps before sending the magic link:
 *   1. Email — validate via /api/auth/email-context, fetch client stores +
 *      languages, advance.
 *   2. Store — pick from the client's actual store list.
 *   3. Language — pick from the client's supported languages.
 *   then → send magic link + persist {storeId, language} in localStorage so
 *   the post-auth /onboarding page can auto-apply them and skip its own
 *   wizard for the user.
 *
 * If the email belongs to an admin, the magic link is sent immediately
 * from step 1 — admins don't have a store / language and route to /admin.
 */
export default function PreLoginWizard() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [language, setLanguage] = useState<string>("");
  const [storeId, setStoreId] = useState<string>("");
  const [hq, setHq] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const segmentIndex =
    step === "email" ? 1 : step === "store" ? 2 : step === "language" ? 3 : 3;

  async function submitEmail() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/email-context", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.status === 403) {
        setError("This email is not authorized. Contact your manager.");
        setPending(false);
        return;
      }
      if (!res.ok) {
        setError("Something went wrong. Please try again.");
        setPending(false);
        return;
      }
      const body = (await res.json()) as {
        ok: true;
        role: "employee" | "admin";
        stores: StoreRow[];
        languages: string[];
      };

      if (body.role === "admin") {
        // Admins skip the store/language picker — send the link immediately.
        await signInWithEmail(email);
        setStep("sent");
        setPending(false);
        return;
      }

      setStores(body.stores);
      setLanguages(body.languages);
      // No auto-select — Figma shows the trigger empty until the user picks.
      // Pre-selecting causes the trigger to mirror the first list row, which
      // reads as a duplicated entry.
      setStep("store");
    } catch (err) {
      setError("Something went wrong. Please try again.");
      console.error(err);
    } finally {
      setPending(false);
    }
  }

  async function submitAll() {
    setError(null);
    setPending(true);
    try {
      // Stash the picked store + language so the post-auth /onboarding page
      // can pick them up after the magic-link click and skip its wizard.
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(
            PRELOGIN_KEY,
            JSON.stringify({
              email,
              storeId: hq ? null : storeId,
              language,
              ts: Date.now(),
            }),
          );
        } catch {
          // localStorage can throw in private-browsing modes — onboarding
          // will fall back to its own wizard if the data isn't here.
        }
      }
      await signInWithEmail(email);
      setStep("sent");
    } catch (err) {
      setError("Something went wrong. Please try again.");
      console.error(err);
    } finally {
      setPending(false);
    }
  }

  const showProgress = step !== "sent";
  const heading =
    step === "email"
      ? "Hi, Welcome Back!"
      : step === "store"
        ? "Select your Store"
        : step === "language"
          ? "Select your Language"
          : "Check your inbox";
  // Subtitle only on email + sent steps. Store + Language drop the subtitle
  // per Figma (the heading is self-explanatory and avoids overlap with the
  // content column below).
  const subtitle =
    step === "email"
      ? "Sign in to keep training on Pandas Vision AI."
      : step === "sent"
        ? `We sent a sign-in link to ${email}. Valid for 24 hours.`
        : null;

  return (
    <div className="relative z-10 mx-auto h-dvh w-full max-w-[402px]">
      {/* HEADER */}
      <div className="absolute left-0 right-0 top-[13.3%] flex flex-col items-center gap-10 px-6">
        {showProgress && <StepProgress current={segmentIndex} total={3} />}
        <div className="w-full max-w-[327px] space-y-2 text-center">
          <h1 className="text-balance text-[24px] font-medium leading-[1.2] tracking-tight text-[#f9fdff]">
            {heading}
          </h1>
          {subtitle && (
            <p className="text-balance text-[14px] font-medium leading-[22px] tracking-[0.07px] text-[#f9fdff]/85">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* CONTENT — centered, 327px wide */}
      <div className="absolute left-1/2 top-1/2 w-[327px] -translate-x-1/2 -translate-y-1/2">
        <AnimatePresence mode="wait" initial={false}>
          {step === "email" && (
            <motion.div
              key="email"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={TRANSITION}
            >
              <EmailField
                value={email}
                onChange={setEmail}
                error={error}
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
          {step === "sent" && (
            <motion.div
              key="sent"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={TRANSITION}
              className="rounded-[24px] border border-arctic-haze/40 bg-[rgba(68,81,88,0.1)] px-5 py-5 text-center text-sm text-[#f9fdff]"
            >
              <p className="font-medium">Sign-in link sent.</p>
              <p className="mt-2 text-[#f9fdff]/70">
                Click the link in the email to continue. We&apos;ll set you up
                with your store and language automatically.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CTA */}
      {step !== "sent" && (
        <div className="absolute left-0 right-0 top-[86%] flex items-center gap-2 px-6">
          {step !== "email" && (
            <BackButton
              onClick={() =>
                step === "store"
                  ? setStep("email")
                  : step === "language"
                    ? setStep("store")
                    : undefined
              }
              disabled={pending}
            />
          )}
          <button
            type="button"
            onClick={() => {
              if (step === "email") submitEmail();
              else if (step === "store") setStep("language");
              else if (step === "language") submitAll();
            }}
            disabled={
              pending ||
              (step === "email" && !email) ||
              (step === "store" && !hq && !storeId) ||
              (step === "language" && !language)
            }
            className="flex h-[56px] flex-1 items-center justify-center rounded-[40px] bg-[#0e0e0e] px-8 text-[16px] font-normal leading-[1.3] text-[#fefefe] transition-colors duration-200 hover:bg-[#1a1a1a] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending
              ? "Sending…"
              : step === "language"
                ? "Send sign-in link"
                : "Continue"}
          </button>
        </div>
      )}
    </div>
  );
}

function EmailField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error: string | null;
}) {
  return (
    <div>
      <label htmlFor="email" className="sr-only">
        Work email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoFocus
        autoComplete="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="andylexian22@orange.com"
        className="block h-[52px] w-full rounded-[24px] border border-[#c1e8fb] bg-[rgba(68,81,88,0.1)] px-4 text-[16px] leading-[1.3] text-[#fefefe] backdrop-blur-md placeholder:text-[#8e8e8e] focus:outline-none focus:ring-2 focus:ring-arctic-haze/40"
      />
      {error && (
        <p className="mt-3 rounded-[16px] border border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
          {error}
        </p>
      )}
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
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#c1e8fb] bg-white/20 text-[#fefefe] backdrop-blur-md transition-all duration-200 hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-40",
      )}
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

export { PRELOGIN_KEY };
