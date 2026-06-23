import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { lessons, lessonGroups, lessonTranslations } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import GroupLessonsManager, {
  type MemberRow,
  type AvailableRow,
} from "./GroupLessonsManager";

export const metadata = { title: "Group · Admin · Dojo" };
export const dynamic = "force-dynamic";

export default async function LessonGroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") notFound();

  const { id } = await params;
  const [group] = await db
    .select()
    .from(lessonGroups)
    .where(eq(lessonGroups.id, id))
    .limit(1);
  if (!group) notFound();

  const [allLessons, translations] = await Promise.all([
    db
      .select()
      .from(lessons)
      .orderBy(lessons.sortOrder, lessons.createdAt),
    db
      .select({
        lessonId: lessonTranslations.lessonId,
        language: lessonTranslations.language,
        title: lessonTranslations.title,
      })
      .from(lessonTranslations),
  ]);

  const titleFor = (lessonId: string): string | null => {
    const cands = translations.filter((t) => t.lessonId === lessonId);
    return (cands.find((t) => t.language === "en") ?? cands[0])?.title ?? null;
  };

  const memberLessons = allLessons
    .filter((l) => l.groupId === id)
    .sort(
      (a, b) =>
        a.groupSortOrder - b.groupSortOrder ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );
  const members: MemberRow[] = memberLessons.map((l, i) => ({
    id: l.id,
    internalName: l.internalName,
    title: titleFor(l.id),
    canMoveUp: i > 0,
    canMoveDown: i < memberLessons.length - 1,
  }));

  const available: AvailableRow[] = allLessons
    .filter((l) => l.groupId !== id)
    .map((l) => ({
      id: l.id,
      internalName: l.internalName,
      title: titleFor(l.id),
      inOtherGroup: l.groupId !== null,
    }));

  return (
    <div className="space-y-8">
      <PageHeader
        back={{ href: "/admin/lesson-groups", label: "Back to groups" }}
        title={group.name}
        description="Order the lessons in this section, and add or remove lessons. Order here is the order employees see on the /browse rail."
      />
      <GroupLessonsManager
        groupId={id}
        members={members}
        available={available}
      />
    </div>
  );
}
