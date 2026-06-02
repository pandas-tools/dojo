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
        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
        isActive
          ? "bg-zinc-100 text-zinc-900 font-medium"
          : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900",
      )}
    >
      {icon && (
        <span
          className={cn(
            "shrink-0",
            isActive ? "text-zinc-900" : "text-zinc-400",
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
