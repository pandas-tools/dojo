"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth, signIn } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { writeAuditEntry } from "@/lib/audit-log";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("forbidden");
  }
  return session;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function addAdmin(input: { email: string }) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" };
  }
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return { error: "Invalid email address" };
  }

  // If a user row already exists with this email, promote them to admin
  // (clearing clientId so they don't carry a tenant scope into the admin
  // role). Otherwise, pre-create the row so the first magic-link sign-in
  // finds an existing admin record.
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    if (existing.role === "admin") {
      return { ok: true, alreadyAdmin: true };
    }
    await db
      .update(users)
      .set({ role: "admin", clientId: null, updatedAt: new Date() })
      .where(eq(users.id, existing.id));
    await writeAuditEntry({
      action: "admin_member.add",
      targetType: "user",
      targetId: existing.id,
      payload: { email, mode: "promoted_existing" },
    });
  } else {
    const [created] = await db
      .insert(users)
      .values({
        email,
        role: "admin",
        clientId: null,
        onboardingCompleted: true,
      })
      .returning();
    await writeAuditEntry({
      action: "admin_member.add",
      targetType: "user",
      targetId: created.id,
      payload: { email, mode: "created" },
    });
  }

  revalidatePath("/admin/members");
  return { ok: true };
}

export async function removeAdmin(input: { userId: string }) {
  const session = await requireAdminOrError();
  if ("error" in session) return session;

  if (session.user.id === input.userId) {
    return { error: "You cannot remove your own admin access" };
  }

  // Delete the admin row entirely. They lose the ability to sign in as
  // admin; if their email is also in ADMIN_ALLOWLIST (env), they'd be
  // re-created as admin on next sign-in — that's the bootstrap path and
  // is documented behaviour. To fully remove a bootstrap admin, also
  // edit ADMIN_ALLOWLIST on Railway.
  const [snapshot] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);
  await db.delete(users).where(eq(users.id, input.userId));

  await writeAuditEntry({
    action: "admin_member.remove",
    targetType: "user",
    targetId: input.userId,
    payload: { email: snapshot?.email ?? null },
  });
  revalidatePath("/admin/members");
  return { ok: true };
}

// Variant that returns the session so the caller can self-protect.
async function requireAdminOrError() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { error: "forbidden" } as const;
  }
  return session;
}

/**
 * Resend a magic-link sign-in email to a specific user. Admin support flow
 * for the "I never got my login email" case. Routes through the same
 * Auth.js Resend provider the public /login form uses, so the receiving
 * email is identical to a fresh sign-in trigger by the user themselves.
 *
 * Works for both employees and admins — any user row with a real email
 * gets one. We don't expose ANY existence signal back to the caller (return
 * shape is identical whether the user exists or not) so an admin can't
 * use this to probe whether an email is registered.
 */
export async function resendMagicLink(input: { userId: string }) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" };
  }
  const [target] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);
  // Silent on not-found so we don't leak existence.
  if (!target?.email) {
    return { ok: true as const };
  }
  try {
    await signIn("resend", { email: target.email, redirect: false });
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? `Could not send magic link: ${err.message}`
          : "Could not send magic link",
    };
  }
  await writeAuditEntry({
    action: "employee.resend_magic_link",
    targetType: "user",
    targetId: target.id,
    payload: { email: target.email },
  });
  return { ok: true as const };
}
