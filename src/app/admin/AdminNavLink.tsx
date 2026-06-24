"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export default function AdminNavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Match exactly for /admin (so it doesn't always look active),
  // prefix-match for sub-routes.
  const isActive =
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
        isActive
          ? "bg-arctic-haze/20 text-near-black font-medium"
          : "text-muted-foreground hover:bg-paper-dusk hover:text-near-black",
      )}
    >
      {icon && (
        <span
          className={cn(
            "shrink-0",
            isActive ? "text-brand-deep" : "text-muted-foreground/70",
          )}
          aria-hidden
        >
          {icon}
        </span>
      )}
      <span>{children}</span>
    </Link>
  );
}
