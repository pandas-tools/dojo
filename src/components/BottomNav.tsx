"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, LayoutGroup } from "motion/react";
import { House, Play, Bookmark, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * BottomNav — primary nav pill, fixed to the bottom of every in-app surface.
 * Matches the Figma file (node I111:2149) — rounded-[100px] glass pill
 * with 4 × 48px icon buttons (Library, Reels, Saved, Profile) and a
 * gradient fade from the page bg to near-black above the pill.
 *
 * Mounted once by the (shell) route-group layout so the active-tab pill can
 * slide between icons via motion's shared-layout animation on navigation.
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

export default function BottomNav({
  reelsHref,
}: {
  /** Direct /watch/[id] link to skip the /watch redirect hop. */
  reelsHref?: string;
}) {
  const pathname = usePathname();
  const items = STATIC_ITEMS.map((item) =>
    item.label === "Reels" && reelsHref ? { ...item, href: reelsHref } : item,
  );

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
        <div className="pointer-events-auto inline-flex items-center gap-4 rounded-[100px] bg-[rgba(14,16,21,0.55)] p-2 backdrop-blur-xl ring-1 ring-white/10">
          <LayoutGroup>
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
                    "relative flex h-12 w-12 items-center justify-center rounded-full",
                    "transition-colors duration-200",
                    active
                      ? "text-[#f9fdff]"
                      : "text-[#f9fdff]/70 hover:text-[#f9fdff]",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="bottom-nav-active-pill"
                      aria-hidden
                      className="absolute inset-0 rounded-full bg-white/10"
                      transition={{
                        type: "spring",
                        stiffness: 380,
                        damping: 32,
                        mass: 0.6,
                      }}
                    />
                  )}
                  <Icon
                    className="relative h-5 w-5"
                    strokeWidth={active ? 2.25 : 2}
                    fill={active && item.label === "Saved" ? "currentColor" : "none"}
                  />
                </Link>
              );
            })}
          </LayoutGroup>
        </div>
      </div>
    </nav>
  );
}
