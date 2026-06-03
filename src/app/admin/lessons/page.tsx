import { notFound } from "next/navigation";
import { GraduationCap } from "lucide-react";
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
import { NewLessonDialog } from "./NewLessonDialog";
import LessonsTable, { type LessonRow } from "./LessonsTable";

export const metadata = { title: "Lessons · Admin · Dojo" };
export const dynamic = "force-dynamic";

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

  const dialogClients = allClients.map((c) => ({ id: c.id, name: c.name }));

  const rows: LessonRow[] = list.map((l) => {
    const ts = transByLesson.get(l.id) ?? [];
    return {
      id: l.id,
      internalName: l.internalName,
      type: l.type,
      isPublished: l.isPublished,
      firstTranslationTitle: ts[0]?.title ?? null,
      translations: ts.map((t) => ({
        id: t.id,
        language: t.language,
        muxState: t.muxPlaybackId
          ? ("ready" as const)
          : t.muxUploadId
            ? ("processing" as const)
            : ("empty" as const),
      })),
      assignmentClientIds: assignmentsByLesson.get(l.id) ?? [],
    };
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Lessons"
        description="Create, configure, assign. Each lesson can carry a video and translations across languages."
        action={<NewLessonDialog clients={dialogClients} />}
      />

      {rows.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
          <EmptyState
            icon={<GraduationCap className="h-5 w-5" />}
            title="No lessons yet"
            description="Create the first lesson — drop a video and we'll handle the rest."
            action={<NewLessonDialog clients={dialogClients} />}
          />
        </div>
      ) : (
        <LessonsTable rows={rows} clients={dialogClients} />
      )}
    </div>
  );
}
