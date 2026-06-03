import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getAuditLog, type AuditLogEntry } from "@/lib/audit-log";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import AuditLogFilters from "./AuditLogFilters";
import AuditLogRow from "./AuditLogRow";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const TARGET_TYPES = [
  "lesson",
  "translation",
  "client",
  "client_domain",
  "client_language",
  "store",
  "admin_member",
  "employee",
] as const;

const ACTION_NAMESPACES = [
  "lesson",
  "translation",
  "client",
  "store",
  "admin_member",
  "employee",
] as const;

type SearchParams = {
  action?: string;
  targetType?: string;
  actor?: string;
  before?: string;
};

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") notFound();

  const sp = await searchParams;
  const entries: AuditLogEntry[] = await getAuditLog({
    action: sp.action || undefined,
    targetType: sp.targetType || undefined,
    actorUserId: sp.actor || undefined,
    before: sp.before || undefined,
    limit: PAGE_SIZE,
  });

  const hasFilters = !!(sp.action || sp.targetType || sp.actor);
  const hasMore = entries.length === PAGE_SIZE;
  const nextBefore = hasMore
    ? entries[entries.length - 1]!.createdAt.toISOString()
    : null;

  const nextParams = new URLSearchParams();
  if (sp.action) nextParams.set("action", sp.action);
  if (sp.targetType) nextParams.set("targetType", sp.targetType);
  if (sp.actor) nextParams.set("actor", sp.actor);
  if (nextBefore) nextParams.set("before", nextBefore);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="Every admin action, in order. Filter by action, target, or actor."
      />

      <AuditLogFilters
        currentAction={sp.action ?? ""}
        currentTargetType={sp.targetType ?? ""}
        actionNamespaces={ACTION_NAMESPACES as unknown as string[]}
        targetTypes={TARGET_TYPES as unknown as string[]}
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>
              Newest first. Click a row to expand its payload.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <EmptyState
              title={hasFilters ? "No matching entries" : "No activity yet"}
              description={
                hasFilters
                  ? "Try widening the filters above."
                  : "Admin actions will appear here as they happen."
              }
            />
          ) : (
            <div className="-mx-3 sm:mx-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium uppercase tracking-wide text-zinc-500 border-b border-zinc-200">
                    <th className="py-2 px-3 font-medium">When</th>
                    <th className="py-2 px-3 font-medium">Actor</th>
                    <th className="py-2 px-3 font-medium">Action</th>
                    <th className="py-2 px-3 font-medium">Target</th>
                    <th className="py-2 px-3 font-medium w-8" />
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <AuditLogRow key={e.id} entry={serialize(e)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {hasMore && nextBefore && (
            <div className="mt-4 flex justify-center">
              <Link
                href={`/admin/audit-log?${nextParams.toString()}`}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-500 transition-colors"
              >
                Load older entries
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Server entries carry a Date; AuditLogRow is a client component, so we
// stringify the timestamp here once.
function serialize(e: AuditLogEntry) {
  return {
    id: e.id,
    createdAt: e.createdAt.toISOString(),
    actorUserId: e.actorUserId,
    actorEmail: e.actorEmail,
    actorName: e.actorName,
    action: e.action,
    targetType: e.targetType,
    targetId: e.targetId,
    payload: e.payload,
  };
}
