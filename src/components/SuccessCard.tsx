"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * SuccessCard — the popup primitive used by all success states.
 *
 * Matches the Figma file (node 96:175 — Success Step):
 *   - bg rgba(14, 16, 21, 0.6) (dark, slightly transparent so the bg sheen
 *     shows through)
 *   - rounded-[16px], padding 24px horizontal / 32px vertical
 *   - 50px icon container at top, 24px gap, then the heading
 *   - Sharp Grotesk Medium 24px, color #fefefe, text width 267px so the
 *     copy wraps on two lines as the Figma designs it
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
        "flex flex-col items-center gap-6 rounded-[16px] border border-white/[0.06] bg-[rgba(14,16,21,0.55)] px-6 py-8 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.55)] backdrop-blur-2xl",
        className,
      )}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="flex h-[50px] w-[50px] items-center justify-center"
      >
        {icon}
      </motion.div>
      <div className="flex w-[267px] flex-col items-center gap-2 text-center">
        <h2 className="text-[24px] font-medium leading-[1.2] tracking-tight text-[#fefefe]">
          {title}
        </h2>
        {subtitle && (
          <p className="text-[8px] leading-[1.3] text-[#fefefe]/80">
            {subtitle}
          </p>
        )}
      </div>
    </motion.div>
  );
}

/**
 * CheckRingIcon — 48px arctic-haze ring with a dark check glyph.
 * Matches the Figma's Success Icon (node 109:971).
 */
export function CheckRingIcon() {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#C1E8FB]">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6 text-[#0e0e0e]"
        aria-hidden
      >
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </div>
  );
}
