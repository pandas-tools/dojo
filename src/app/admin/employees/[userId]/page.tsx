import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getEmployeeDetail } from "@/lib/analytics-detail";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import ResendMagicLinkButton from "./ResendMagicLinkButton";

export const dynamic = "force-dynamic";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") notFound();

  const { userId } = await params;
  const detail = await getEmployeeDetail(userId);
  if (!detail) notFound();

  const { user, lessons, groupRatings, totals } = detail;

  const backHref = user.clientId
    ? `/admin/clients/${user.clientId}`
    : "/admin/members";
  const backLabel = user.clientId
    ? `Back to ${user.clientName ?? "client"}`
    : "Back to members";

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: backHref, label: backLabel }}
        title={user.name ?? user.email}
        description={
          user.name ? user.email : `${roleLabel(user.role)} on Dojo`
        }
        action={
          <ResendMagicLinkButton userId={user.userId} email={user.email} />
        }
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Snapshot of the user&apos;s current state.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <DLItem label="Role">
              <RolePill role={user.role} />
            </DLItem>
            <DLItem label="Email">
              <span className="font-mono text-xs text-zinc-700 break-all">
                {user.email}
              </span>
            </DLItem>
            <DLItem label="Client">
              {user.clientId && user.clientName ? (
                <Link
                  href={`/admin/clients/${user.clientId}`}
                  className="text-zinc-900 underline underline-offset-2 hover:text-zinc-700"
                >
                  {user.clientName}
                </Link>
              ) : (
                <span className="text-zinc-500">—</span>
              )}
            </DLItem>
            <DLItem label="Store">
              <span className="text-zinc-700">{user.storeName ?? "—"}</span>
            </DLItem>
            <DLItem label="Preferred language">
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-mono uppercase text-zinc-700">
                {user.preferredLanguage}
              </code>
            </DLItem>
            <DLItem label="Onboarding">
              {user.onboardingCompleted ? (
                <Badge variant="success">Completed</Badge>
              ) : (
                <Badge variant="warning">Pending</Badge>
              )}
              {user.storeConfirmedAt && (
                <span className="ml-2 text-xs text-zinc-500">
                  confirmed {formatDate(user.storeConfirmedAt)}
                </span>
              )}
            </DLItem>
            <DLItem label="First seen">
              <span className="text-zinc-700">{formatDate(user.createdAt)}</span>
            </DLItem>
            <DLItem label="Last touched">
              <span className="text-zinc-700">{formatDate(user.updatedAt)}</span>
            </DLItem>
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Assigned" value={String(totals.assigned)} />
        <Stat label="Opened" value={String(totals.opened)} />
        <Stat label="Completed" value={String(totals.completed)} />
        <Stat label="Saved" value={String(totals.bookmarked)} />
        <Stat
          label="Avg rating"
          value={
            totals.avgRating !== null
              ? `${totals.avgRating.toFixed(1)} ★`
              : "—"
          }
        />
        <Stat
          label="Engaged time"
          value={formatDuration(totals.totalEngagedMs)}
        />
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Lesson history</CardTitle>
            <CardDescription>
              Per-lesson activity for this user, across everything currently
              assigned to their client.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {lessons.length === 0 ? (
            <EmptyState
              title="No lessons assigned"
              description={
                user.role === "admin"
                  ? "Admins don't carry a client assignment."
                  : "Once the client has lessons assigned, they'll show here."
              }
            />
          ) : (
            <div className="-mx-3 sm:mx-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium uppercase tracking-wide text-zinc-500 border-b border-zinc-200">
                    <th className="py-2 px-3 font-medium">Lesson</th>
                    <th className="py-2 px-3 font-medium">Opened</th>
                    <th className="py-2 px-3 font-medium">Completed</th>
                    <th className="py-2 px-3 font-medium">Engaged</th>
                    <th className="py-2 px-3 font-medium">Last activity</th>
                  </tr>
                </thead>
                <tbody>
                  {lessons.map((l) => (
                    <tr
                      key={l.lessonId}
                      className="border-b last:border-b-0 border-zinc-100"
                    >
                      <td className="py-2.5 px-3">
                        <Link
                          href={`/admin/lessons/${l.lessonId}`}
                          className="text-zinc-900 hover:underline"
                        >
                          {l.title || l.internalName}
                        </Link>
                        {l.title && l.internalName && l.title !== l.internalName && (
                          <div className="text-xs text-zinc-500">{l.internalName}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {l.opened ? <span className="text-emerald-700">✓</span> : <span className="text-zinc-400">—</span>}
                      </td>
                      <td className="py-2.5 px-3">
                        {l.completed ? <span className="text-emerald-700">✓</span> : <span className="text-zinc-400">—</span>}
                      </td>
                      <td className="py-2.5 px-3 text-zinc-600">
                        {l.totalEngagedMs > 0 ? formatDuration(l.totalEngagedMs) : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-zinc-600 whitespace-nowrap">
                        {l.lastActivityAt ? formatDate(l.lastActivityAt) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Group ratings</CardTitle>
            <CardDescription>
              Ratings this user submitted after completing every lesson in a
              group.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {groupRatings.length === 0 ? (
            <EmptyState
              title="No group ratings yet"
              description="Ratings show up here once the user finishes every lesson in a group and submits a rating."
            />
          ) : (
            <div className="-mx-3 sm:mx-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium uppercase tracking-wide text-zinc-500 border-b border-zinc-200">
                    <th className="py-2 px-3 font-medium">Group</th>
                    <th className="py-2 px-3 font-medium">Rating</th>
                    <th className="py-2 px-3 font-medium">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {groupRatings.map((r) => (
                    <tr
                      key={r.groupId}
                      className="border-b last:border-b-0 border-zinc-100"
                    >
                      <td className="py-2.5 px-3 text-zinc-900">{r.groupName}</td>
                      <td className="py-2.5 px-3 text-zinc-700">{r.rating} ★</td>
                      <td className="py-2.5 px-3 text-zinc-600 whitespace-nowrap">
                        {formatDate(r.ratedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DLItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-zinc-900 flex items-center">{children}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-0.5 text-xl font-semibold text-zinc-900">{value}</div>
    </div>
  );
}

function RolePill({ role }: { role: "employee" | "admin" | "client_admin" }) {
  if (role === "admin") return <Badge variant="info">Admin</Badge>;
  if (role === "client_admin") return <Badge variant="info">Client admin</Badge>;
  return <Badge variant="neutral">Employee</Badge>;
}

function roleLabel(role: "employee" | "admin" | "client_admin"): string {
  if (role === "admin") return "Admin";
  if (role === "client_admin") return "Client admin";
  return "Employee";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return "0s";
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min < 60) return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  return remMin > 0 ? `${hr}h ${remMin}m` : `${hr}h`;
}
