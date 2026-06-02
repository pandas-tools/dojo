import Link from "next/link";
import { notFound } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  clients,
  lessons,
  lessonCompletions,
  users,
} from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Admin · Dojo" };
export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") notFound();

  const [clientList, [lessonStat], [completionStat], [userStat]] =
    await Promise.all([
      db.select().from(clients).orderBy(clients.name),
      db.select({ value: count() }).from(lessons),
      db.select({ value: count() }).from(lessonCompletions),
      db
        .select({ value: count() })
        .from(users)
        .where(eq(users.role, "employee")),
    ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Dojo at a glance. Manage clients, lessons, members, and content from the nav."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Clients" value={clientList.length} href="/admin/clients" />
        <Stat label="Lessons" value={lessonStat.value} href="/admin/lessons" />
        <Stat
          label="Employees"
          value={userStat.value}
          href="/admin/analytics"
        />
        <Stat
          label="Completions"
          value={completionStat.value}
          href="/admin/analytics"
        />
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-5 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">Clients</h2>
          <Link
            href="/admin/clients"
            className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            Manage clients →
          </Link>
        </div>
        {clientList.length === 0 ? (
          <p className="p-6 text-sm text-zinc-500">No clients yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {clientList.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/admin/clients/${c.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-zinc-50/60 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-medium text-zinc-900 truncate">
                      {c.name}
                    </span>
                    <span className="text-xs text-zinc-400 font-mono">
                      {c.slug}
                    </span>
                  </div>
                  {c.isActive ? (
                    <Badge variant="success">Active</Badge>
                  ) : (
                    <Badge variant="neutral">Inactive</Badge>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-zinc-200 bg-white p-4 hover:border-zinc-400 transition-colors"
    >
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-zinc-900">{value}</div>
    </Link>
  );
}
