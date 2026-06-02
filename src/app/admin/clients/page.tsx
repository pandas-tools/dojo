import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Building2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  clients,
  clientAllowedDomains,
  clientLessons,
  stores,
  users,
} from "@/lib/db/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import NewClientDialog from "./NewClientDialog";

export const metadata = { title: "Clients · Admin · Dojo" };
export const dynamic = "force-dynamic";

export default async function AdminClientsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") notFound();

  const clientList = await db.select().from(clients).orderBy(clients.name);
  const allDomains = await db.select().from(clientAllowedDomains);
  const allLessons = await db.select().from(clientLessons);
  const allStores = await db.select().from(stores);
  const allUsers = await db
    .select()
    .from(users)
    .where(eq(users.role, "employee"));

  const domainsByClient = group(allDomains, (d) => d.clientId);
  const lessonsByClient = group(allLessons, (l) => l.clientId);
  const storesByClient = group(allStores, (s) => s.clientId);
  const usersByClient = group(allUsers, (u) => u.clientId ?? "");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Pandas clients on Dojo. Each has its own allowed sign-in domains, language picker, stores, and assigned lessons."
        action={<NewClientDialog />}
      />

      {clientList.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white">
          <EmptyState
            icon={<Building2 className="h-5 w-5" />}
            title="No clients yet"
            description="Add your first client to start configuring domains, stores, and lesson assignments."
            action={<NewClientDialog />}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {clientList.map((c) => {
            const domains = domainsByClient.get(c.id) ?? [];
            const assigned = lessonsByClient.get(c.id) ?? [];
            const storeCount = (storesByClient.get(c.id) ?? []).length;
            const userCount = (usersByClient.get(c.id) ?? []).length;
            return (
              <Link
                key={c.id}
                href={`/admin/clients/${c.id}`}
                className="block rounded-lg border border-zinc-200 bg-white p-5 hover:border-zinc-400 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-zinc-900">
                        {c.name}
                      </h3>
                      {c.isActive ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="neutral">Inactive</Badge>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5 font-mono">
                      {c.slug}
                    </p>
                  </div>
                  <span className="text-xs text-zinc-400">Manage →</span>
                </div>
                <dl className="mt-4 grid grid-cols-4 gap-x-6 text-sm">
                  <Stat label="Stores" value={storeCount} />
                  <Stat label="Employees" value={userCount} />
                  <Stat label="Lessons" value={assigned.length} />
                  <Stat label="Domains" value={domains.length} />
                </dl>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-zinc-500">
        {label}
      </dt>
      <dd className="text-zinc-900 font-semibold text-lg mt-0.5">{value}</dd>
    </div>
  );
}

function group<T, K>(items: T[], key: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const arr = m.get(k) ?? [];
    arr.push(item);
    m.set(k, arr);
  }
  return m;
}
