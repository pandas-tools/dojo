"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";

/**
 * ShellFade — soft opacity crossfade between shell routes.
 * Keyed on pathname so navigating /browse ↔ /saved ↔ /profile fades the
 * current page out before the next fades in. mode="wait" holds the exit
 * until the incoming page is ready — pairs with the bottom-nav pill glide
 * (~400ms spring) so the two motions feel like one gesture.
 */
export default function ShellFade({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
