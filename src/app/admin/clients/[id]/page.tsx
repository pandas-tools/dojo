import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  clients,
  clientAllowedDomains,
  clientLanguages,
  clientLessons,
  stores,
  users,
  lessons,
  lessonTranslations,
  lessonCompletions,
} from "@/lib/db/schema";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import ClientDetailEditor from "./ClientDetailEditor";
import DomainsEditor from "./DomainsEditor";
import LanguagesEditor from "./LanguagesEditor";
import StoresManager from "./StoresManager";
import DeleteClientButton from "./DeleteClientButton";
import ClientLessonsAssigner from "./ClientLessonsAssigner";

export const metadata = { title: "Client · Admin · Dojo" };
export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") notFound();

  const { id } = await params;
  const [
    [client],
    domains,
    langs,
    assignments,
    clientStores,
    clientUsers,
    allLessons,
  ] = await Promise.all([
    db.select().from(clients).where(eq(clients.id, id)).limit(1),
    db
      .select()
      .from(clientAllowedDomains)
      .where(eq(clientAllowedDomains.clientId, id)),
    db.select().from(clientLanguages).where(eq(clientLanguages.clientId, id)),
    db.select().from(clientLessons).where(eq(clientLessons.clientId, id)),
    db.select().from(stores).where(eq(stores.clientId, id)),
    db.select().from(users).where(eq(users.clientId, id)),
    db.select().from(lessons).orderBy(lessons.sortOrder, lessons.createdAt),
  ]);

  if (!client) notFound();

  const lessonIds = assignments.map((a) => a.lessonId);

  // English titles for all lessons (used in the assigner chip labels)
  const allLessonIds = allLessons.map((l) => l.id);
  const enTranslations =
    allLessonIds.length > 0
      ? await db
          .select()
          .from(lessonTranslations)
          .where(
            and(
              eq(lessonTranslations.language, "en"),
              inArray(lessonTranslations.lessonId, allLessonIds),
            ),
          )
      : [];
  const titleByLesson = new Map(
    enTranslations.map((t) => [t.lessonId, t.title]),
  );
  const lessonsForAssigner = allLessons.map((l) => ({
    id: l.id,
    internalName: l.internalName,
    title: titleByLesson.get(l.id) ?? null,
  }));

  // Per-employee completions, restricted to lessons currently assigned to
  // this client. Mirrors the analytics pattern so stale completions from
  // a previous tenant assignment can't inflate the counts here.
  const completionRows =
    clientUsers.length > 0 && lessonIds.length > 0
      ? await db
          .select({
            userId: lessonCompletions.userId,
            lessonId: lessonCompletions.lessonId,
            completedAt: lessonCompletions.completedAt,
          })
          .from(lessonCompletions)
          .where(
            and(
              inArray(
                lessonCompletions.userId,
                clientUsers.map((u) => u.id),
              ),
              inArray(lessonCompletions.lessonId, lessonIds),
            ),
          )
      : [];

  const completionsByUser = new Map<
    string,
    { count: number; lastAt: Date | null }
  >();
  for (const c of completionRows) {
    const prior = completionsByUser.get(c.userId) ?? {
      count: 0,
      lastAt: null as Date | null,
    };
    prior.count += 1;
    if (!prior.lastAt || c.completedAt > prior.lastAt)
      prior.lastAt = c.completedAt;
    completionsByUser.set(c.userId, prior);
  }

  const storeNameById = new Map(clientStores.map((s) => [s.id, s.name]));
  const totalAssigned = lessonIds.length;

  const employees = [...clientUsers]
    .sort((a, b) => {
      const aLast = completionsByUser.get(a.id)?.lastAt?.getTime() ?? 0;
      const bLast = completionsByUser.get(b.id)?.lastAt?.getTime() ?? 0;
      if (aLast !== bLast) return bLast - aLast;
      return a.email.localeCompare(b.email);
    })
    .map((u) => {
      const stat = completionsByUser.get(u.id);
      return {
        id: u.id,
        email: u.email,
        storeName: u.storeId
          ? (storeNameById.get(u.storeId) ?? "—")
          : "HQ / other",
        completed: stat?.count ?? 0,
        lastActive: stat?.lastAt ?? null,
      };
    });

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/admin/clients", label: "Back to clients" }}
        title={client.name}
        description={
          <span className="flex items-center gap-2 text-xs">
            <code className="font-mono text-zinc-500">{client.slug}</code>
            {client.isActive ? (
              <Badge variant="success">Active</Badge>
            ) : (
              <Badge variant="neutral">Inactive</Badge>
            )}
          </span>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Stores" value={clientStores.length} />
        <Stat label="Employees" value={clientUsers.length} />
        <Stat label="Lessons assigned" value={assignments.length} />
        <Stat label="Allowed domains" value={domains.length} />
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Details</CardTitle>
            <CardDescription>
              Rename, change slug, or pause employee sign-in.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <ClientDetailEditor client={client} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Allowed email domains</CardTitle>
            <CardDescription>
              Any employee with an email at one of these domains can sign in
              and is auto-assigned to this client.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <DomainsEditor
            clientId={client.id}
            domains={domains.map((d) => d.domain)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Languages</CardTitle>
            <CardDescription>
              Shown in the employee onboarding picker. English is the
              system-wide fallback and should always be enabled.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <LanguagesEditor
            clientId={client.id}
            languages={langs.map((l) => l.language)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Assigned lessons</CardTitle>
            <CardDescription>
              Tap a chip to assign or unassign. Employees only see lessons
              that are both published AND assigned to this client.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <ClientLessonsAssigner
            clientId={client.id}
            lessons={lessonsForAssigner}
            assignedIds={lessonIds}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Stores</CardTitle>
            <CardDescription>
              Physical locations for this client. Add one-by-one or paste a
              CSV. Employees pick their store during onboarding.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <StoresManager
            clientId={client.id}
            stores={clientStores.map((s) => ({
              id: s.id,
              name: s.name,
              city: s.city,
              countryCode: s.countryCode,
              externalId: s.externalId,
              isActive: s.isActive,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Employees</CardTitle>
            <CardDescription>
              {employees.length === 0
                ? "No employees have signed in yet."
                : `${employees.length} total. Sorted by most recent activity.`}
            </CardDescription>
          </div>
          <Link
            href={`/admin/analytics/${client.id}`}
            className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            Full analytics →
          </Link>
        </CardHeader>
        {employees.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  <th className="px-5 py-2.5">Email</th>
                  <th className="px-5 py-2.5">Store</th>
                  <th className="px-5 py-2.5">Completed</th>
                  <th className="px-5 py-2.5">Last active</th>
                </tr>
              </thead>
              <tbody>
                {employees.slice(0, 25).map((e) => (
                  <tr
                    key={e.id}
                    className="border-b last:border-b-0 border-zinc-100"
                  >
                    <td className="px-5 py-2.5 font-medium text-zinc-900">
                      {e.email}
                    </td>
                    <td className="px-5 py-2.5 text-zinc-600">{e.storeName}</td>
                    <td className="px-5 py-2.5 text-zinc-700">
                      {e.completed} / {totalAssigned}
                    </td>
                    <td className="px-5 py-2.5 text-zinc-600">
                      {e.lastActive ? e.lastActive.toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {employees.length > 25 && (
              <p className="border-t border-zinc-200 bg-zinc-50 px-5 py-2 text-xs text-zinc-500">
                Showing 25 of {employees.length}.{" "}
                <Link
                  href={`/admin/analytics/${client.id}`}
                  className="text-zinc-900 underline underline-offset-2"
                >
                  See the full list in analytics →
                </Link>
              </p>
            )}
          </div>
        )}
      </Card>

      <Card className="border-red-200">
        <CardHeader>
          <div>
            <CardTitle className="text-red-900">Danger zone</CardTitle>
            <CardDescription>
              Deleting a client is permanent and removes its stores, employees,
              completions, allowed domains, and assignments.
            </CardDescription>
          </div>
          <DeleteClientButton
            clientId={client.id}
            clientName={client.name}
            stats={{
              stores: clientStores.length,
              employees: clientUsers.length,
              lessons: assignments.length,
            }}
          />
        </CardHeader>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-0.5 text-xl font-semibold text-zinc-900">{value}</div>
    </div>
  );
}
