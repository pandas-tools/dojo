import { notFound } from "next/navigation";
import { Layers } from "lucide-react";
import { db } from "@/lib/db/client";
import { lessons, lessonGroups } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import NewGroupDialog from "./NewGroupDialog";
import GroupsList, { type GroupRow } from "./GroupsList";

export const metadata = { title: "Lesson groups · Admin · Dojo" };
export const dynamic = "force-dynamic";

export default async function AdminLessonGroupsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") notFound();

  const [groups, lessonRows] = await Promise.all([
    db
      .select()
      .from(lessonGroups)
      .orderBy(lessonGroups.sortOrder, lessonGroups.createdAt),
    db.select({ id: lessons.id, groupId: lessons.groupId }).from(lessons),
  ]);

  const countByGroup = new Map<string, number>();
  let ungroupedCount = 0;
  for (const l of lessonRows) {
    if (l.groupId) {
      countByGroup.set(l.groupId, (countByGroup.get(l.groupId) ?? 0) + 1);
    } else {
      ungroupedCount += 1;
    }
  }

  const rows: GroupRow[] = groups.map((g, i) => ({
    id: g.id,
    name: g.name,
    lessonCount: countByGroup.get(g.id) ?? 0,
    canMoveUp: i > 0,
    canMoveDown: i < groups.length - 1,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Lesson groups"
        description="Editorial sections for the employee browse experience. Order the sections and the lessons inside them; each section becomes a rail."
        action={<NewGroupDialog />}
      />

      {rows.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
          <EmptyState
            icon={<Layers className="h-5 w-5" />}
            title="No groups yet"
            description="Create the first editorial section, then drag lessons into it."
            action={<NewGroupDialog />}
          />
        </div>
      ) : (
        <GroupsList rows={rows} ungroupedCount={ungroupedCount} />
      )}
    </div>
  );
}
