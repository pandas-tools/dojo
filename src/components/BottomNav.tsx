"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Play, Bookmark, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * BottomNav — primary nav pill, fixed to the bottom of every in-app surface.
 * Matches the Figma file (node I111:2149) — rounded-[100px] glass pill
 * with 4 × 48px icon buttons (Library, Reels, Saved, Profile) and a
 * gradient fade from the page bg to near-black above the pill.
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
  userInitial,
  reelsHref,
}: {
  /** Kept for API parity; the Figma nav uses a User icon, not an avatar. */
  userInitial?: string;
  /** Direct /watch/[id] link to skip the /watch redirect hop. */
  reelsHref?: string;
}) {
  const pathname = usePathname();
  // `userInitial` is intentionally unused now — the Figma navbar uses the
  // generic User icon. Kept in the prop list for backwards compatibility.
  void userInitial;
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
                  "flex h-12 w-12 items-center justify-center rounded-full",
                  "transition-colors",
                  active
                    ? "bg-white/10 text-[#f9fdff]"
                    : "text-[#f9fdff]/70 hover:bg-white/[0.06] hover:text-[#f9fdff]",
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
