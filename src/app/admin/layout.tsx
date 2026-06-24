import { redirect } from "next/navigation";
import Link from "next/link";
import {
  LayoutGrid,
  GraduationCap,
  Layers,
  Trophy,
  Building2,
  BarChart3,
  Users,
  ScrollText,
  LogOut,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { signOutAction } from "../actions";
import AdminNavLink from "./AdminNavLink";
import MobileNavTrigger from "./MobileNavTrigger";
import { Toaster } from "@/components/ui/toaster";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect("/browse");

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col sm:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden sm:flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-white">
        <div className="px-5 py-5 border-b border-zinc-200">
          <Link
            href="/admin"
            className="flex items-center gap-2 text-zinc-900"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-900 text-white text-xs font-bold">
              D
            </span>
            <span className="font-semibold tracking-tight">Dojo</span>
            <span className="text-xs text-zinc-400 font-normal">admin</span>
          </Link>
        </div>
        <nav className="flex-1 px-2.5 py-3 space-y-0.5">
          <AdminNavLink href="/admin" icon={<LayoutGrid className="h-4 w-4" />}>
            Overview
          </AdminNavLink>
          <AdminNavLink
            href="/admin/lessons"
            icon={<GraduationCap className="h-4 w-4" />}
          >
            Lessons
          </AdminNavLink>
          <AdminNavLink
            href="/admin/lesson-groups"
            icon={<Layers className="h-4 w-4" />}
          >
            Lesson groups
          </AdminNavLink>
          <AdminNavLink
            href="/admin/tiers"
            icon={<Trophy className="h-4 w-4" />}
          >
            Tiers
          </AdminNavLink>
          <AdminNavLink
            href="/admin/clients"
            icon={<Building2 className="h-4 w-4" />}
          >
            Clients
          </AdminNavLink>
          <AdminNavLink
            href="/admin/analytics"
            icon={<BarChart3 className="h-4 w-4" />}
          >
            Analytics
          </AdminNavLink>
          <AdminNavLink
            href="/admin/members"
            icon={<Users className="h-4 w-4" />}
          >
            Members
          </AdminNavLink>
          <AdminNavLink
            href="/admin/audit-log"
            icon={<ScrollText className="h-4 w-4" />}
          >
            Audit log
          </AdminNavLink>
        </nav>
        <div className="border-t border-zinc-200 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p
              className="text-xs text-zinc-500 truncate"
              title={session.user.email ?? ""}
            >
              {session.user.email}
            </p>
            <form action={signOutAction}>
              <button
                type="submit"
                className="text-zinc-400 hover:text-zinc-900 transition-colors p-1 -m-1"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Mobile top bar — sticky for navigation persistence on scroll */}
      <header className="sm:hidden sticky top-0 z-30 flex items-center justify-between border-b border-zinc-200 bg-white/90 backdrop-blur px-4 py-3">
        <MobileNavTrigger
          email={session.user.email ?? ""}
          signOutAction={signOutAction}
        />
        <Link
          href="/admin"
          className="flex items-center gap-2 text-zinc-900"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-900 text-white text-xs font-bold">
            D
          </span>
          <span className="font-semibold tracking-tight text-sm">Dojo</span>
        </Link>
        <span className="w-9" aria-hidden />
      </header>

      <main className="flex-1 min-w-0 px-4 sm:px-6 py-6 sm:py-10 max-w-5xl sm:mx-0 mx-auto w-full">
        {children}
      </main>

      <Toaster />
    </div>
  );
}
