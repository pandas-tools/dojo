import Link from "next/link";
import { notFound } from "next/navigation";
import { GraduationCap, Circle } from "lucide-react";
import { db } from "@/lib/db/client";
import {
  lessons,
  lessonTranslations,
  clientLessons,
  clients,
} from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { NewLessonDialog } from "./NewLessonDialog";
import ReorderButtons from "./ReorderButtons";

export const metadata = { title: "Lessons · Admin · Dojo" };
export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  training: "Training",
  announcement: "Announcement",
  update: "Update",
};

export default async function AdminLessonsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") notFound();

  const [list, allTranslations, allAssignments, allClients] = await Promise.all([
    db.select().from(lessons).orderBy(lessons.sortOrder, lessons.createdAt),
    db.select().from(lessonTranslations),
    db.select().from(clientLessons),
    db.select().from(clients).orderBy(clients.name),
  ]);

  const transByLesson = new Map<string, typeof allTranslations>();
  for (const t of allTranslations) {
    const arr = transByLesson.get(t.lessonId) ?? [];
    arr.push(t);
    transByLesson.set(t.lessonId, arr);
  }

  const assignmentsByLesson = new Map<string, string[]>();
  for (const a of allAssignments) {
    const arr = assignmentsByLesson.get(a.lessonId) ?? [];
    arr.push(a.clientId);
    assignmentsByLesson.set(a.lessonId, arr);
  }

  const clientNameById = new Map(allClients.map((c) => [c.id, c.name]));
  const dialogClients = allClients.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Lessons"
        description="Create, configure, assign. Each lesson can carry a video and translations across languages."
        action={<NewLessonDialog clients={dialogClients} />}
      />

      <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
        {list.length === 0 ? (
          <EmptyState
            icon={<GraduationCap className="h-5 w-5" />}
            title="No lessons yet"
            description="Create the first lesson — drop a video and we'll handle the rest."
            action={<NewLessonDialog clients={dialogClients} />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-2.5 w-20">Order</th>
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">Translations</th>
                  <th className="px-4 py-2.5">Assigned to</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((l, i) => {
                  const ts = transByLesson.get(l.id) ?? [];
                  const assigned = assignmentsByLesson.get(l.id) ?? [];
                  return (
                    <tr
                      key={l.id}
                      className="border-b last:border-b-0 border-zinc-100 hover:bg-zinc-50/60 transition-colors"
                    >
                      <td className="px-4 py-3 align-middle">
                        <ReorderButtons
                          lessonId={l.id}
                          canMoveUp={i > 0}
                          canMoveDown={i < list.length - 1}
                        />
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="font-medium text-zinc-900">
                          {l.internalName}
                        </div>
                        {ts[0]?.title && (
                          <div className="text-xs text-zinc-500 mt-0.5 truncate max-w-xs">
                            {ts[0].title}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <span className="text-zinc-700 text-xs">
                          {TYPE_LABEL[l.type] ?? l.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        {ts.length === 0 ? (
                          <span className="text-zinc-400 text-xs">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {ts.map((t) => (
                              <span
                                key={t.id}
                                className="inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-mono uppercase text-zinc-700"
                                title={
                                  t.muxPlaybackId
                                    ? "Video ready"
                                    : t.muxUploadId
                                      ? "Video processing"
                                      : "No video"
                                }
                              >
                                {t.language}
                                {t.muxPlaybackId ? (
                                  <Circle className="h-1.5 w-1.5 fill-emerald-500 text-emerald-500" />
                                ) : t.muxUploadId ? (
                                  <Circle className="h-1.5 w-1.5 fill-amber-500 text-amber-500 animate-pulse" />
                                ) : (
                                  <Circle className="h-1.5 w-1.5 fill-zinc-300 text-zinc-300" />
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        {assigned.length === 0 ? (
                          <span className="text-zinc-400 text-xs">—</span>
                        ) : assigned.length <= 2 ? (
                          <span className="text-zinc-700 text-xs">
                            {assigned
                              .map((id) => clientNameById.get(id) ?? id)
                              .join(", ")}
                          </span>
                        ) : (
                          <span className="text-zinc-700 text-xs">
                            {assigned.length} clients
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        {l.isPublished ? (
                          <Badge variant="success">Published</Badge>
                        ) : (
                          <Badge variant="neutral">Draft</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle text-right">
                        <Link
                          href={`/admin/lessons/${l.id}`}
                          className="text-zinc-500 hover:text-zinc-900 text-xs transition-colors"
                        >
                          Manage →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
