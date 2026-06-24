import { notFound } from "next/navigation";
import { isNull } from "drizzle-orm";
import { Trophy } from "lucide-react";
import { db } from "@/lib/db/client";
import { lessonTiers } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import NewTierDialog from "./NewTierDialog";
import TiersTable, { type TierRow } from "./TiersTable";

export const metadata = { title: "Tiers · Admin · Dojo" };
export const dynamic = "force-dynamic";

export default async function AdminTiersPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") notFound();

  // Admin v1 manages the global ladder (client_id IS NULL).
  const tiers = await db
    .select()
    .from(lessonTiers)
    .where(isNull(lessonTiers.clientId))
    .orderBy(lessonTiers.sortOrder, lessonTiers.createdAt);

  const rows: TierRow[] = tiers.map((t, i) => ({
    id: t.id,
    name: t.name,
    emoji: t.emoji,
    minPct: t.minPct,
    canMoveUp: i > 0,
    canMoveDown: i < tiers.length - 1,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tiers"
        description="The gamification ladder employees climb on browse. A tier is reached once an employee completes its threshold share of their assigned lessons. Colleague counts shown to employees are organisation-wide."
        action={<NewTierDialog />}
      />

      {rows.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
          <EmptyState
            icon={<Trophy className="h-5 w-5" />}
            title="No tiers yet"
            description="Browse falls back to the built-in Apprentice / Specialist / Expert ladder until you define tiers here."
            action={<NewTierDialog />}
          />
        </div>
      ) : (
        <TiersTable rows={rows} />
      )}
    </div>
  );
}
