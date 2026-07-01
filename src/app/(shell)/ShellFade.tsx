"use client";

import { usePathname } from "next/navigation";

/**
 * ShellFade — soft opacity fade-in for shell routes on navigation.
 *
 * Uses a CSS keyframe animation (see .shell-fade-in in globals.css) rather
 * than a motion.div with initial={{opacity:0}}. The motion approach applied
 * opacity: 0 AFTER React's initial DOM commit, so under Next.js RSC the
 * new page briefly rendered at opacity: 1 before motion pulled it to 0,
 * reading as a doubled render. CSS animations apply their `from` state
 * before the first browser paint, so the fade-in is clean.
 */
export default function ShellFade({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="shell-fade-in">
      {children}
    </div>
  );
}
