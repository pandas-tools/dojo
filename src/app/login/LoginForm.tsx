"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check } from "lucide-react";
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
    <AnimatePresence mode="wait" initial={false}>
      {sent ? (
        <motion.div
          key="sent"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={TRANSITION}
          className="rounded-2xl border border-arctic-haze/30 bg-arctic-haze/[0.07] p-5 text-sm text-white"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-arctic-haze text-near-black">
              <Check className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <p className="font-medium">Check your inbox</p>
          </div>
          <p className="mt-3 text-white/70">
            We sent a sign-in link to{" "}
            <span className="font-mono text-arctic-haze">{email}</span>. The link
            is valid for 24 hours.
          </p>
        </motion.div>
      ) : (
        <motion.form
          key="form"
          onSubmit={onSubmit}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={TRANSITION}
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="email"
              className="mb-2 block font-mono text-xs font-medium uppercase tracking-wider text-white/55"
            >
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
              placeholder="you@orange.be"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm text-white placeholder:text-white/30 transition-shadow focus:border-arctic-haze/60 focus:outline-none focus:ring-2 focus:ring-arctic-haze/40"
            />
          </div>

          {error && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending || !email}
            className="inline-flex w-full items-center justify-center rounded-2xl bg-arctic-haze px-4 py-3.5 font-mono text-sm font-medium uppercase tracking-wider text-near-black transition-opacity duration-200 hover:opacity-90 disabled:opacity-40"
          >
            {pending ? "Sending…" : "Continue"}
          </button>

          <p className="pt-1 text-center text-xs text-white/45">
            We&apos;ll email you a one-time sign-in link.
          </p>
        </motion.form>
      )}
    </AnimatePresence>
  );
}
