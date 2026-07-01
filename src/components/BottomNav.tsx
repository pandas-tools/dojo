"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { House, Play, Bookmark, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * BottomNav — primary nav pill, fixed to the bottom of every in-app surface.
 * Matches the Figma file (node I111:2149) — rounded-[100px] glass pill
 * with 4 × 48px icon buttons (Library, Reels, Saved, Profile).
 *
 * Mounted once by the (shell) route-group layout so the active pill can
 * slide between icons on navigation. Pure declarative glide via animate={{x}}
 * — no velocity-driven scale (which produced sub-frame scale micro-updates
 * that read as flicker on the ring border).
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
              className="pointer-events-none absolute left-2 top-2 h-12 w-12 rounded-full bg-white/[0.12] ring-1 ring-inset ring-white/[0.06]"
              initial={false}
              animate={{ x: activeIndex * (BTN_W + GAP) }}
              transition={{ type: "spring", stiffness: 260, damping: 30, mass: 0.9 }}
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
