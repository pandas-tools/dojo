"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * SuccessCard — the glass-card primitive used by all success states
 * (onboarding complete, lesson complete, tier unlocked). The icon slot
 * gets a soft arctic-haze halo behind it; the card itself enters with a
 * small lift + scale.
 */
export default function SuccessCard({
  icon,
  title,
  subtitle,
  className,
}: {
  icon: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "relative w-full max-w-sm rounded-3xl border border-white/12 bg-white/[0.04] p-7 text-center backdrop-blur-2xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]",
        className,
      )}
    >
      <div className="pointer-events-none absolute -inset-x-4 -top-6 h-20 bg-[radial-gradient(60%_100%_at_50%_100%,rgba(193,232,251,0.22),transparent_70%)]" />
      <div className="relative flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="mb-5 flex h-14 w-14 items-center justify-center text-3xl"
        >
          {icon}
        </motion.div>
        <h2 className="text-balance text-[22px] font-medium leading-tight tracking-tight text-white sm:text-2xl">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-2 text-sm text-white/70">{subtitle}</p>
        )}
      </div>
    </motion.div>
  );
}

/**
 * CheckRingIcon — arctic-haze circle with a check glyph. The default icon for
 * the onboarding success card.
 */
export function CheckRingIcon() {
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-arctic-haze">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-7 w-7 text-near-black"
        aria-hidden
      >
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </div>
  );
}
