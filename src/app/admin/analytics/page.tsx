import { notFound } from "next/navigation";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { auth } from "@/lib/auth";
import { getClientAnalytics, type ClientAnalytics } from "@/lib/analytics";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Analytics · Admin · Dojo" };
export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") notFound();

  const data = await getClientAnalytics();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Training rollout health, per client. Live numbers — no caching, no aggregation tables."
      />

      {data.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white">
          <EmptyState
            icon={<BarChart3 className="h-5 w-5" />}
            title="No clients yet"
            description="Add a client first — analytics will populate from real activity."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((c) => (
            <ClientCard key={c.clientId} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function ClientCard({ c }: { c: ClientAnalytics }) {
  const storeActivationPct =
    c.storeCount > 0
      ? Math.round((c.activeStoreCount / c.storeCount) * 100)
      : 0;
  const trainedPct =
    c.employeeCount > 0
      ? Math.round((c.trainedEmployeeCount / c.employeeCount) * 100)
      : 0;

  return (
    <Link
      href={`/admin/analytics/${c.clientId}`}
      className="block rounded-lg border border-zinc-200 bg-white p-6 hover:border-zinc-400 transition-colors"
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">{c.name}</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {c.assignedLessonCount} lesson
            {c.assignedLessonCount === 1 ? "" : "s"} assigned
          </p>
        </div>
        <span className="text-xs text-zinc-400">View detail →</span>
      </div>

      <dl className="grid gap-6 sm:grid-cols-3">
        <Metric
          label="Store activation"
          big={`${c.activeStoreCount} / ${c.storeCount}`}
          sub={
            c.storeCount > 0
              ? `${storeActivationPct}% have training activity`
              : "No stores configured"
          }
          bar={c.storeCount > 0 ? c.activeStoreCount / c.storeCount : 0}
          empty={c.storeCount === 0}
        />
        <Metric
          label="Trained employees"
          big={`${c.trainedEmployeeCount} / ${c.employeeCount}`}
          sub={
            c.assignedLessonCount === 0
              ? "No lessons assigned yet"
              : c.employeeCount === 0
                ? "No employees yet"
                : c.avgTrainedPerActiveStore !== null
                  ? `${c.avgTrainedPerActiveStore} per active store · ${trainedPct}% overall`
                  : `${trainedPct}% overall`
          }
          bar={
            c.employeeCount > 0 ? c.trainedEmployeeCount / c.employeeCount : 0
          }
          empty={c.employeeCount === 0 || c.assignedLessonCount === 0}
        />
        <Metric
          label="Average rating"
          big={c.avgRating !== null ? `${c.avgRating} / 5` : "—"}
          sub={
            c.responseCount > 0
              ? `from ${c.responseCount} response${c.responseCount === 1 ? "" : "s"}`
              : "No ratings yet"
          }
          bar={c.avgRating !== null ? c.avgRating / 5 : 0}
          empty={c.avgRating === null}
        />
      </dl>
    </Link>
  );
}

function Metric({
  label,
  big,
  sub,
  bar,
  empty,
}: {
  label: string;
  big: string;
  sub: string;
  bar: number;
  empty?: boolean;
}) {
  const pct = Math.max(0, Math.min(1, bar)) * 100;
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-zinc-500">
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-semibold text-zinc-900">{big}</dd>
      <p className="mt-1 text-xs text-zinc-600">{sub}</p>
      <div className="mt-2 h-1 w-full rounded-full bg-zinc-100">
        <div
          className={`h-1 rounded-full transition-all ${
            empty ? "bg-zinc-300" : "bg-emerald-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
