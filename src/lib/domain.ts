import { and, eq } from "drizzle-orm";
import { db } from "./db/client";
import { clientAllowedDomains, users } from "./db/schema";
import { adminAllowlist } from "./env";

export function extractDomain(email: string): string | null {
  const at = email.indexOf("@");
  if (at < 0) return null;
  return email.slice(at + 1).toLowerCase().trim();
}

export type DomainCheckResult =
  | { kind: "employee"; clientId: string }
  | { kind: "admin" }
  | { kind: "rejected" };

/**
 * Decide whether an email is allowed to receive a magic link.
 * - Employee: domain is in client_allowed_domains for some client
 * - Admin: email is in ADMIN_ALLOWLIST
 * - Rejected: neither
 */
export async function checkEmailAllowed(
  email: string,
): Promise<DomainCheckResult> {
  const normalized = email.toLowerCase().trim();
  // Environment-variable bootstrap admins. Useful so the very first admin
  // can sign in without any DB state.
  if (adminAllowlist().includes(normalized)) {
    return { kind: "admin" };
  }
  // DB-managed admins, added via /admin/members. We look these up by
  // exact-email match on a users row with role='admin' and no client.
  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, normalized), eq(users.role, "admin")))
    .limit(1);
  if (admin) return { kind: "admin" };
  // Otherwise fall through to the per-client domain allowlist.
  const domain = extractDomain(normalized);
  if (!domain) return { kind: "rejected" };
  const [match] = await db
    .select()
    .from(clientAllowedDomains)
    .where(eq(clientAllowedDomains.domain, domain))
    .limit(1);
  if (!match) return { kind: "rejected" };
  return { kind: "employee", clientId: match.clientId };
}
