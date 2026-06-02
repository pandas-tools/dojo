"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Menu,
  LayoutGrid,
  GraduationCap,
  Building2,
  BarChart3,
  Users,
  LogOut,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";

const NAV_ITEMS = [
  { href: "/admin", label: "Overview", Icon: LayoutGrid },
  { href: "/admin/lessons", label: "Lessons", Icon: GraduationCap },
  { href: "/admin/clients", label: "Clients", Icon: Building2 },
  { href: "/admin/analytics", label: "Analytics", Icon: BarChart3 },
  { href: "/admin/members", label: "Members", Icon: Users },
];

export default function MobileNavTrigger({
  email,
  signOutAction,
}: {
  email: string;
  signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Auto-close on navigation
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md p-2 -m-2 text-zinc-700 hover:bg-zinc-100 transition-colors"
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      <SheetContent side="left" hideClose>
        <SheetTitle className="sr-only">Admin navigation</SheetTitle>
        <div className="px-5 py-5 border-b border-zinc-200">
          <Link
            href="/admin"
            className="flex items-center gap-2 text-zinc-900"
            onClick={() => setOpen(false)}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-900 text-white text-xs font-bold">
              D
            </span>
            <span className="font-semibold tracking-tight">Dojo</span>
            <span className="text-xs text-zinc-400 font-normal">admin</span>
          </Link>
        </div>
        <nav className="flex-1 px-2.5 py-3 space-y-0.5">
          {NAV_ITEMS.map(({ href, label, Icon }) => {
            const isActive =
              href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-zinc-100 text-zinc-900 font-medium"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    isActive ? "text-zinc-900" : "text-zinc-400",
                  )}
                />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-zinc-200 px-4 py-3">
          <p
            className="text-xs text-zinc-500 truncate mb-2"
            title={email}
          >
            {email}
          </p>
          <form action={signOutAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
