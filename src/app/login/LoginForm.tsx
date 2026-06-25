"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import StepProgress from "@/components/StepProgress";
import { signInWithEmail } from "./actions";

const TRANSITION = { duration: 0.4, ease: [0.25, 1, 0.5, 1] } as const;

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/check-domain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        setError("This email is not authorized. Contact your manager.");
        setPending(false);
        return;
      }
      await signInWithEmail(email);
      setSent(true);
    } catch (err) {
      setError("Something went wrong. Please try again.");
      console.error(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="relative z-10 mx-auto h-dvh w-full max-w-[402px]"
    >
      {/* HEADER — top 13.3% (matches Figma's top-[116px] of 874) */}
      <div className="absolute left-0 right-0 top-[13.3%] flex flex-col items-center gap-10 px-6">
        <StepProgress current={1} total={3} />
        <div className="space-y-2 text-center">
          <h1 className="text-[24px] font-medium leading-[1.2] tracking-tight text-[#f9fdff]">
            {sent ? "Check your inbox" : "Hi, Welcome Back!"}
          </h1>
          {!sent && (
            <p className="text-[14px] font-medium leading-[22px] tracking-[0.07px] text-[#f9fdff]/85">
              Sign in to keep training on Pandas&nbsp;Vision&nbsp;AI.
            </p>
          )}
        </div>
      </div>

      {/* FORM — vertically centered, 327px wide */}
      <div className="absolute left-1/2 top-1/2 w-[327px] -translate-x-1/2 -translate-y-1/2">
        <AnimatePresence mode="wait" initial={false}>
          {sent ? (
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
                We sent a link to{" "}
                <span className="font-mono text-arctic-haze">{email}</span>. The
                link is valid for 24 hours.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={TRANSITION}
            >
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="andylexian22@orange.com"
                className="block h-[52px] w-full rounded-[24px] border border-[#c1e8fb] bg-[rgba(68,81,88,0.1)] px-4 text-[16px] leading-[1.3] text-[#fefefe] placeholder:text-[#8e8e8e] focus:outline-none focus:ring-2 focus:ring-arctic-haze/40"
              />
              {error && (
                <p className="mt-3 rounded-[16px] border border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
                  {error}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CTA — bottom 14% (matches Figma's top-[752px] of 874) */}
      {!sent && (
        <div className="absolute left-0 right-0 top-[86%] px-6">
          <button
            type="submit"
            disabled={pending || !email}
            className="flex h-[56px] w-full items-center justify-center rounded-[40px] bg-[#0e0e0e] px-8 text-[16px] font-normal leading-[1.3] text-[#fefefe] transition-colors duration-200 hover:bg-[#1a1a1a] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Sending…" : "Continue"}
          </button>
        </div>
      )}
    </form>
  );
}
