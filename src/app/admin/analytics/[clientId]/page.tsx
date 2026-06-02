import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getClientDetailAnalytics,
  type FunnelStage,
  type StoreRow,
  type LessonRow,
  type EmployeeRow,
  type TimelinePoint,
} from "@/lib/analytics-detail";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const data = await getClientDetailAnalytics(clientId);
  return {
    title: `${data?.clientName ?? "Client"} · Analytics · Dojo`,
  };
}

export default async function ClientDetailAnalyticsPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") notFound();

  const { clientId } = await params;
  const data = await getClientDetailAnalytics(clientId);
  if (!data) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/admin/analytics", label: "All clients" }}
        title={data.clientName}
        description={`${data.totals.storeCount} store${data.totals.storeCount === 1 ? "" : "s"} · ${data.totals.employeeCount} employee${data.totals.employeeCount === 1 ? "" : "s"} · ${data.totals.assignedLessonCount} lesson${data.totals.assignedLessonCount === 1 ? "" : "s"} assigned`}
      />

      <Section title="Training funnel">
        <Funnel funnel={data.funnel} />
      </Section>

      <Section title="Activity timeline (last 30 days)">
        <Timeline points={data.timeline} />
      </Section>

      <Section title="Stores">
        <StoresTable rows={data.stores} />
      </Section>

      <Section title="Lesson breakdown">
        <LessonsTable rows={data.lessons} />
      </Section>

      <Section title="Employees">
        <EmployeesTable rows={data.employees} />
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500 mb-2">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Timeline({ points }: { points: TimelinePoint[] }) {
  const total = points.reduce((a, p) => a + p.completions, 0);
  if (total === 0) {
    return (
      <p className="text-sm text-zinc-500 rounded-md border border-zinc-200 bg-white p-4">
        No completions in the last 30 days yet.
      </p>
    );
  }
  const max = Math.max(1, ...points.map((p) => p.completions));
  const width = 600;
  const height = 120;
  const padding = { top: 8, right: 8, bottom: 18, left: 8 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const slot = innerW / points.length;
  const barW = Math.max(3, slot - 2);
  const firstLabel = new Date(points[0].date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const lastLabel = new Date(points[points.length - 1].date).toLocaleDateString(
    undefined,
    { month: "short", day: "numeric" },
  );
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4">
      <div className="flex items-baseline justify-between mb-2 text-xs text-zinc-500">
        <span>{total} completion{total === 1 ? "" : "s"} in 30 days</span>
        <span>peak day {max}</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-32"
        role="img"
        aria-label="Daily completions for the last 30 days"
      >
        {points.map((p, i) => {
          const x = padding.left + i * slot + (slot - barW) / 2;
          const h = (p.completions / max) * innerH;
          const y = padding.top + (innerH - h);
          return (
            <g key={p.date}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(p.completions > 0 ? 2 : 0, h)}
                rx="1"
                className="fill-emerald-500"
              />
              <title>
                {new Date(p.date).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
                : {p.completions} completion{p.completions === 1 ? "" : "s"}
              </title>
            </g>
          );
        })}
      </svg>
      <div className="flex items-baseline justify-between mt-1 text-xs text-zinc-500">
        <span>{firstLabel}</span>
        <span>{lastLabel}</span>
      </div>
    </div>
  );
}

function Funnel({ funnel }: { funnel: FunnelStage[] }) {
  const maxCount = Math.max(1, ...funnel.map((f) => f.count));
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4 space-y-3">
      {funnel.map((stage, i) => {
        const widthPct = (stage.count / maxCount) * 100;
        const dropFromPrev =
          i > 0 ? funnel[i - 1].count - stage.count : null;
        return (
          <div key={stage.label}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium text-zinc-800">{stage.label}</span>
              <span className="text-zinc-600">
                {stage.count}
                {i > 0 && (
                  <>
                    <span className="mx-1 text-zinc-400">·</span>
                    <span className="text-xs text-zinc-500">
                      {(stage.rate * 100).toFixed(0)}% conversion
                      {dropFromPrev !== null && dropFromPrev > 0 && (
                        <> · {dropFromPrev} drop-off</>
                      )}
                    </span>
                  </>
                )}
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-zinc-100">
              <div
                className="h-3 rounded-full bg-emerald-500 transition-all"
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StoresTable({ rows }: { rows: StoreRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-zinc-500 rounded-md border border-zinc-200 bg-white p-4">
        No stores configured.
      </p>
    );
  }
  return (
    <div className="rounded-md border border-zinc-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-3 py-2">Store</th>
            <th className="px-3 py-2">City</th>
            <th className="px-3 py-2 text-right">Employees</th>
            <th className="px-3 py-2 text-right">Completed all</th>
            <th className="px-3 py-2 text-right">Completion %</th>
            <th className="px-3 py-2 text-right">Avg rating</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.storeId} className="border-t border-zinc-200">
              <td className="px-3 py-2 font-medium">{r.name}</td>
              <td className="px-3 py-2 text-zinc-600">{r.city ?? "—"}</td>
              <td className="px-3 py-2 text-right">{r.employeesLoggedIn}</td>
              <td className="px-3 py-2 text-right">{r.completedAll}</td>
              <td className="px-3 py-2 text-right">
                {r.employeesLoggedIn > 0
                  ? `${Math.round(r.completionPct * 100)}%`
                  : "—"}
              </td>
              <td className="px-3 py-2 text-right">
                {r.avgRating !== null
                  ? `${r.avgRating} (${r.ratingCount})`
                  : "—"}
              </td>
              <td className="px-3 py-2">
                <StatusPill status={r.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ status }: { status: StoreRow["status"] }) {
  const map = {
    "on-track": { label: "On track", variant: "success" as const },
    "low-completion": { label: "Low completion", variant: "warning" as const },
    "no-activity": { label: "No activity", variant: "neutral" as const },
    "no-data": { label: "No lessons", variant: "neutral" as const },
  };
  const m = map[status];
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

function LessonsTable({ rows }: { rows: LessonRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-zinc-500 rounded-md border border-zinc-200 bg-white p-4">
        No lessons assigned to this client.
      </p>
    );
  }
  return (
    <div className="rounded-md border border-zinc-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-3 py-2">Lesson</th>
            <th className="px-3 py-2 text-right">Completions</th>
            <th className="px-3 py-2 text-right">Completion %</th>
            <th className="px-3 py-2 text-right">Avg rating</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.lessonId} className="border-t border-zinc-200">
              <td className="px-3 py-2">
                <div className="font-medium">{r.title}</div>
                <div className="text-xs text-zinc-500 font-mono">
                  {r.internalName}
                </div>
              </td>
              <td className="px-3 py-2 text-right">{r.completionCount}</td>
              <td className="px-3 py-2 text-right">
                {Math.round(r.completionPct * 100)}%
              </td>
              <td className="px-3 py-2 text-right">
                {r.avgRating !== null
                  ? `${r.avgRating} (${r.ratingCount})`
                  : "—"}
              </td>
              <td className="px-3 py-2 text-right">
                <Link
                  href={`/admin/lessons/${r.lessonId}`}
                  className="text-xs text-zinc-700 hover:underline"
                >
                  Manage →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmployeesTable({ rows }: { rows: EmployeeRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-zinc-500 rounded-md border border-zinc-200 bg-white p-4">
        No employees signed up yet.
      </p>
    );
  }
  return (
    <div className="rounded-md border border-zinc-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">Store</th>
            <th className="px-3 py-2 text-right">Progress</th>
            <th className="px-3 py-2">Last active</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.userId} className="border-t border-zinc-200">
              <td className="px-3 py-2 font-mono text-xs">{r.email}</td>
              <td className="px-3 py-2 text-zinc-600">{r.storeName ?? "—"}</td>
              <td className="px-3 py-2 text-right">
                {r.completedCount} / {r.assignedCount}
              </td>
              <td className="px-3 py-2 text-zinc-600">
                {r.lastActiveAt ? formatRelative(r.lastActiveAt) : "Never"}
              </td>
              <td className="px-3 py-2">
                <EmployeeStatusPill status={r.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmployeeStatusPill({ status }: { status: EmployeeRow["status"] }) {
  const map = {
    "not-started": { label: "Not started", variant: "neutral" as const },
    "in-progress": { label: "In progress", variant: "warning" as const },
    completed: { label: "Completed", variant: "success" as const },
  };
  const m = map[status];
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.round((now - then) / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.round(day / 30);
  return `${mo}mo ago`;
}
