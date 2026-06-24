"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, Home, Play } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type Item = {
  href: string;
  /** Active when the current pathname starts with this prefix. */
  matchPrefix: string;
  label: string;
  icon: LucideIcon;
};

const STATIC_ITEMS: Item[] = [
  { href: "/browse", matchPrefix: "/browse", label: "Library", icon: Home },
  // Reels href is injected per-page so the link goes straight to /watch/[id]
  // and skips the /watch redirect — that's what was causing the white flash
  // (double-navigation revealed body bg between transitions).
  { href: "/watch", matchPrefix: "/watch", label: "Reels", icon: Play },
  { href: "/saved", matchPrefix: "/saved", label: "Saved", icon: Bookmark },
];

export default function BottomNav({
  userInitial,
  reelsHref,
  overlay = false,
}: {
  userInitial: string;
  /** Direct /watch/[id] link to skip the redirect hop; falls back to /watch. */
  reelsHref?: string;
  /** When true, render with a heavier backdrop so the bar reads against video. */
  overlay?: boolean;
}) {
  const pathname = usePathname();
  const items = STATIC_ITEMS.map((item) =>
    item.label === "Reels" && reelsHref ? { ...item, href: reelsHref } : item,
  );

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 pointer-events-none",
        "pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2",
      )}
    >
      <div className="mx-auto flex max-w-sm justify-center px-4">
        <div
          className={cn(
            "pointer-events-auto inline-flex items-center gap-2.5 rounded-full",
            "px-2.5 py-2",
            overlay
              ? "bg-zinc-900/80 backdrop-blur-md ring-1 ring-white/10"
              : "bg-zinc-900/95 ring-1 ring-white/10 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)]",
          )}
        >
          {items.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.matchPrefix);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 w-16 items-center justify-center rounded-full",
                  "transition-colors",
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/70 hover:text-white",
                )}
              >
                <Icon
                  className="h-5 w-5"
                  strokeWidth={active ? 2.25 : 1.85}
                  fill={active && item.label === "Saved" ? "currentColor" : "none"}
                />
              </Link>
            );
          })}

          <ProfileSlot
            active={pathname.startsWith("/profile")}
            initial={userInitial}
          />
        </div>
      </div>
    </nav>
  );
}

function ProfileSlot({
  active,
  initial,
}: {
  active: boolean;
  initial: string;
}) {
  return (
    <Link
      href="/profile"
      aria-label="Profile"
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-11 w-11 items-center justify-center rounded-full",
        active ? "ring-2 ring-white" : "ring-1 ring-white/20",
        "bg-white text-black text-sm font-semibold",
        "transition-shadow",
      )}
    >
      <span>{initial}</span>
    </Link>
  );
}
