"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  motion,
  animate,
  useMotionValue,
  useVelocity,
  useTransform,
} from "motion/react";
import { House, Play, Bookmark, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * BottomNav — primary nav pill, fixed to the bottom of every in-app surface.
 * Matches the Figma file (node I111:2149) — rounded-[100px] glass pill
 * with 4 × 48px icon buttons (Library, Reels, Saved, Profile).
 *
 * Mounted once by the (shell) route-group layout so the active pill can
 * slide between icons on navigation. Uses an imperative motion value:
 * `animate()` springs `x` on activeIndex change, `useVelocity` reads the
 * spring's instantaneous speed, `useTransform` maps that to scaleX/scaleY
 * so the pill stretches horizontally in flight and rounds up on arrival.
 */
type Item = {
  href: string;
  matchPrefix: string;
  label: string;
  icon: LucideIcon;
};

const STATIC_ITEMS: Item[] = [
  { href: "/browse", matchPrefix: "/browse", label: "Library", icon: House },
  { href: "/watch", matchPrefix: "/watch", label: "Reels", icon: Play },
  { href: "/saved", matchPrefix: "/saved", label: "Saved", icon: Bookmark },
  { href: "/profile", matchPrefix: "/profile", label: "Profile", icon: User },
];

const BTN_W = 48; // h-12 w-12
const GAP = 16; // gap-4
const posFor = (i: number) => i * (BTN_W + GAP);

export default function BottomNav({
  reelsHref,
}: {
  reelsHref?: string;
}) {
  const pathname = usePathname();
  const items = STATIC_ITEMS.map((item) =>
    item.label === "Reels" && reelsHref ? { ...item, href: reelsHref } : item,
  );

  const rawIndex = items.findIndex((item) =>
    pathname.startsWith(item.matchPrefix),
  );
  const activeIndex = rawIndex >= 0 ? rawIndex : 0;
  const hasActive = rawIndex >= 0;

  const x = useMotionValue(posFor(activeIndex));
  useEffect(() => {
    const controls = animate(x, posFor(activeIndex), {
      type: "spring",
      stiffness: 280,
      damping: 24,
      mass: 0.9,
    });
    return controls.stop;
  }, [x, activeIndex]);
  const velocity = useVelocity(x);
  const scaleX = useTransform(velocity, [-1400, 0, 1400], [1.3, 1, 1.3]);
  const scaleY = useTransform(velocity, [-1400, 0, 1400], [0.86, 1, 0.86]);

  return (
    <nav
      aria-label="Primary"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40"
      style={{
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)",
        paddingTop: "2.5rem",
        backgroundImage:
          "linear-gradient(to top, #111 30%, rgba(17,17,17,0.7) 60%, rgba(17,17,17,0) 100%)",
      }}
    >
      <div className="mx-auto flex justify-center px-4">
        <div className="pointer-events-auto relative inline-flex items-center gap-4 rounded-[100px] bg-[rgba(14,16,21,0.55)] p-2 backdrop-blur-xl ring-1 ring-white/10">
          {hasActive && (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute left-2 top-2 h-12 w-12 rounded-full bg-white/[0.14] ring-1 ring-inset ring-white/[0.08] shadow-[0_0_24px_-6px_rgba(193,232,251,0.28)]"
              style={{ x, scaleX, scaleY, transformOrigin: "center" }}
            />
          )}
          {items.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.matchPrefix);
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative z-10 flex h-12 w-12 items-center justify-center rounded-full",
                  "transition-colors duration-200",
                  active
                    ? "text-[#f9fdff]"
                    : "text-[#f9fdff]/70 hover:text-[#f9fdff]",
                )}
              >
                <Icon
                  className="h-5 w-5"
                  strokeWidth={active ? 2.25 : 2}
                  fill={active && item.label === "Saved" ? "currentColor" : "none"}
                />
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
