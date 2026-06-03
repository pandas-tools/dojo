// Helper for writing entries to admin_audit_log.
//
// Call writeAuditEntry() at the END of any successful admin write action.
// On failure (auth, validation, db error) the action's early return skips
// the log — we only record completed mutations. Writes are best-effort:
// log failures are warned but never bubble up, so a flaky log row can't
// fail the admin's actual write.
//
// Action strings are namespaced verbs: "<resource>.<verb>". Standardized
// vocab today (extend as new actions ship):
//
//   lesson.create | lesson.update | lesson.delete | lesson.publish
//   lesson.unpublish | lesson.reorder | lesson.assign | lesson.unassign
//   translation.add | translation.update | translation.delete
//   translation.image.update | translation.image.clear | translation.image.copy_from_en
//   translation.carousel.update | translation.carousel.clear | translation.carousel.copy_from_en
//   translation.video.clear | translation.video.copy_from_en
//   client.create | client.update | client.delete
//   client.domain.add | client.domain.remove | client.language.add | client.language.remove
//   store.create | store.update | store.delete | store.bulk_import
//   admin_member.add | admin_member.remove
//   employee.resend_magic_link
//
// targetType is the resource the action acts on; targetId is its primary
// key (or a composite like "{lessonId}:{language}" when the action targets
// a junction row). payload is free-shape jsonb — what would help a future
// investigator reconstruct the change.

import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { adminAuditLog } from "@/lib/db/schema";

export interface AuditEntryInput {
  action: string;
  targetType: string;
  targetId: string;
  /** Optional context. Snapshot of pre-change state, ids list for bulk ops, etc. */
  payload?: Record<string, unknown>;
  /**
   * Override the actor. Pass when the action runs outside a normal admin
   * session (e.g. cron). Default: pull from the current Auth.js session.
   */
  actorUserId?: string | null;
}

export async function writeAuditEntry(input: AuditEntryInput): Promise<void> {
  try {
    let actorUserId = input.actorUserId ?? null;
    if (actorUserId === null && input.actorUserId === undefined) {
      const session = await auth();
      actorUserId = session?.user?.id ?? null;
    }
    await db.insert(adminAuditLog).values({
      actorUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      payload: input.payload ?? null,
    });
  } catch (err) {
    console.warn(
      "audit-log: writeAuditEntry failed (entry dropped, action still happened):",
      err instanceof Error ? err.message : String(err),
    );
  }
}

// ----- read side ----------------------------------------------------------

export interface AuditLogQuery {
  /** Filter by exact action ("lesson.publish") or namespace ("lesson.*"). */
  action?: string;
  /** Filter by target resource type ("lesson", "translation", "client"...). */
  targetType?: string;
  /** Filter by specific target id. Pairs with targetType for "show me everything that's happened to lesson X". */
  targetId?: string;
  /** Filter by acting admin user id. */
  actorUserId?: string;
  /** Page size. Defaults to 50, capped at 200. */
  limit?: number;
  /** Cursor — `createdAt` of the last row from the previous page (ISO string). Returns rows strictly older. */
  before?: string;
}

export interface AuditLogEntry {
  id: string;
  createdAt: Date;
  actorUserId: string | null;
  actorEmail: string | null;
  actorName: string | null;
  action: string;
  targetType: string;
  targetId: string;
  payload: Record<string, unknown> | null;
}

import { and, desc, eq, like, lt } from "drizzle-orm";
import { users } from "@/lib/db/schema";

export async function getAuditLog(q: AuditLogQuery = {}): Promise<AuditLogEntry[]> {
  const limit = Math.min(Math.max(q.limit ?? 50, 1), 200);
  const conds = [];
  if (q.action) {
    if (q.action.endsWith(".*")) {
      conds.push(like(adminAuditLog.action, q.action.slice(0, -1) + "%"));
    } else {
      conds.push(eq(adminAuditLog.action, q.action));
    }
  }
  if (q.targetType) conds.push(eq(adminAuditLog.targetType, q.targetType));
  if (q.targetId) conds.push(eq(adminAuditLog.targetId, q.targetId));
  if (q.actorUserId) conds.push(eq(adminAuditLog.actorUserId, q.actorUserId));
  if (q.before) conds.push(lt(adminAuditLog.createdAt, new Date(q.before)));

  const rows = await db
    .select({
      id: adminAuditLog.id,
      createdAt: adminAuditLog.createdAt,
      actorUserId: adminAuditLog.actorUserId,
      actorEmail: users.email,
      actorName: users.name,
      action: adminAuditLog.action,
      targetType: adminAuditLog.targetType,
      targetId: adminAuditLog.targetId,
      payload: adminAuditLog.payload,
    })
    .from(adminAuditLog)
    .leftJoin(users, eq(users.id, adminAuditLog.actorUserId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    payload: (r.payload as Record<string, unknown> | null) ?? null,
  }));
}
