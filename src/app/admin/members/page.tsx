import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { adminAllowlist } from "@/lib/env";
import { PageHeader } from "@/components/ui/page-header";
import MembersClient from "./MembersClient";

export const metadata = { title: "Members · Admin · Dojo" };
export const dynamic = "force-dynamic";

export default async function AdminMembersPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") notFound();

  const adminRows = await db
    .select({
      id: users.id,
      email: users.email,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.role, "admin"), isNull(users.clientId)))
    .orderBy(users.email);

  const envAdmins = new Set(adminAllowlist());

  const admins = adminRows.map((a) => ({
    id: a.id,
    email: a.email,
    createdAt: a.createdAt.toISOString(),
    self: a.id === session.user.id,
    fromEnv: envAdmins.has(a.email.toLowerCase()),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Members"
        description="Who has admin access to Dojo. Add or remove on the fly — bootstrap admins are seeded via the ADMIN_ALLOWLIST env var."
      />
      <MembersClient admins={admins} />
    </div>
  );
}
