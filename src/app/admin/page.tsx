import Link from "next/link";
import { notFound } from "next/navigation";
import { count, countDistinct, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { clients, lessons, lessonEvents, users } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Admin · Dojo" };
export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") notFound();

  // Completion count = distinct (user, lesson) pairs that have a
  // lesson_completed event. Replaces the pre-cutover count of
  // lesson_completions rows (table dropped in migration 0009).
  const [clientList, [lessonStat], [completionStat], [userStat]] =
    await Promise.all([
      db.select().from(clients).orderBy(clients.name),
      db.select({ value: count() }).from(lessons),
      db
        .select({
          value: countDistinct(
            sql`(${lessonEvents.userId}, ${lessonEvents.lessonId})`,
          ),
        })
        .from(lessonEvents)
        .where(eq(lessonEvents.eventType, "lesson_completed")),
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

      <div className="rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3 flex items-center justify-between">
          <h2 className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Clients
          </h2>
          <Link
            href="/admin/clients"
            className="font-mono text-xs uppercase tracking-wider text-brand-deep hover:text-near-black transition-colors"
          >
            Manage clients →
          </Link>
        </div>
        {clientList.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No clients yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {clientList.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/admin/clients/${c.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-snowglint transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-medium text-near-black truncate">
                      {c.name}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
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
      className="rounded-2xl border border-border bg-card p-4 transition-colors hover:border-arctic-haze/60 hover:bg-arctic-haze/[0.04]"
    >
      <div className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-2xl font-medium text-near-black tabular-nums">{value}</div>
    </Link>
  );
}
