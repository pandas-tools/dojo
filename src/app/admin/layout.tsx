import { redirect } from "next/navigation";
import Link from "next/link";
import {
  LayoutGrid,
  GraduationCap,
  Building2,
  BarChart3,
  Users,
  LogOut,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { signOutAction } from "../actions";
import AdminNavLink from "./AdminNavLink";
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
    <div className="min-h-screen bg-zinc-50 flex">
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

      {/* Mobile top bar (sidebar collapses on narrow viewports) */}
      <header className="sm:hidden flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-3 w-full">
        <Link
          href="/admin"
          className="flex items-center gap-2 font-semibold text-zinc-900 text-sm"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-zinc-900 text-white text-[10px] font-bold">
            D
          </span>
          Dojo
        </Link>
        <form action={signOutAction}>
          <button
            type="submit"
            className="text-xs text-zinc-600 hover:text-zinc-900"
          >
            Sign out
          </button>
        </form>
      </header>

      <main className="flex-1 px-6 py-10 max-w-5xl mx-auto sm:mx-0 w-full">
        {children}
      </main>

      <Toaster />
    </div>
  );
}
