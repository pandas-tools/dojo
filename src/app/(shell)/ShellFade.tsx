"use client";

import { motion } from "motion/react";
import { usePathname } from "next/navigation";

/**
 * ShellFade — soft opacity fade-in for shell routes on navigation.
 *
 * Uses a keyed motion.div (no AnimatePresence). On pathname change,
 * React unmounts the old page and mounts the new one, which animates
 * opacity 0 → 1 over ~180ms against the shell's bg-near-black backdrop.
 *
 * Deliberately no exit animation — AnimatePresence's exiting element
 * inherits the new children prop under Next.js RSC (both key and children
 * update in the same commit), so the incoming page would visibly fade
 * OUT and then IN, reading as a doubled render.
 */
export default function ShellFade({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
