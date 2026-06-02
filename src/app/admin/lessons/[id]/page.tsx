import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  lessons,
  lessonTranslations,
  clientLessons,
  clients,
} from "@/lib/db/schema";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import PublishToggle from "./PublishToggle";
import AssignmentManager from "./AssignmentManager";
import TranslationsManager from "./TranslationsManager";
import LessonMetaEditor from "./LessonMetaEditor";
import DeleteLessonButton from "./DeleteLessonButton";

export const dynamic = "force-dynamic";

export default async function LessonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") notFound();

  const { id } = await params;
  const [[lesson], translations, assignments, allClients] = await Promise.all([
    db.select().from(lessons).where(eq(lessons.id, id)).limit(1),
    db
      .select()
      .from(lessonTranslations)
      .where(eq(lessonTranslations.lessonId, id)),
    db.select().from(clientLessons).where(eq(clientLessons.lessonId, id)),
    db.select().from(clients).orderBy(clients.name),
  ]);

  if (!lesson) notFound();

  const en = translations.find((t) => t.language === "en");

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/admin/lessons", label: "Back to lessons" }}
        title={lesson.internalName}
        description={
          en?.title
            ? en.description
              ? `${en.title} — ${en.description}`
              : en.title
            : null
        }
        action={
          <PublishToggle
            lessonId={lesson.id}
            isPublished={lesson.isPublished}
          />
        }
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Metadata</CardTitle>
            <CardDescription>
              For your reference. Internal name is not shown to employees.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <LessonMetaEditor
            lessonId={lesson.id}
            initialInternalName={lesson.internalName}
            initialType={lesson.type as "training" | "announcement" | "update"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Translations</CardTitle>
            <CardDescription>
              English is required and acts as the system-wide fallback. Add
              other languages with their own video (dubbed) or share the
              English video (subtitled via Mux auto-captions).
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <TranslationsManager
            lessonId={lesson.id}
            translations={translations.map((t) => ({
              id: t.id,
              language: t.language,
              title: t.title,
              description: t.description,
              notesMarkdown: t.notesMarkdown,
              muxPlaybackId: t.muxPlaybackId,
              muxUploadId: t.muxUploadId,
              durationSeconds: t.durationSeconds,
              thumbnailUrl: t.thumbnailUrl,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Assignments</CardTitle>
            <CardDescription>
              Which clients see this lesson. Pick from the chips below.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <AssignmentManager
            lessonId={lesson.id}
            clients={allClients}
            assignedIds={assignments.map((a) => a.clientId)}
          />
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardHeader>
          <div>
            <CardTitle className="text-red-900">Danger zone</CardTitle>
            <CardDescription>
              Deletion is permanent. Removes the lesson, its translations, its
              assignments, and any completions tied to it.
            </CardDescription>
          </div>
          <DeleteLessonButton
            lessonId={lesson.id}
            lessonName={lesson.internalName}
          />
        </CardHeader>
      </Card>
    </div>
  );
}
