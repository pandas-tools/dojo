// Full Auth.js config — Node-runtime only.
//
// This is what's used by:
//   - /api/auth/[…nextauth] handler
//   - `await auth()` in Server Components and Server Actions
//   - signIn() / signOut() helpers
//
// It layers DB-backed concerns (Drizzle adapter, JWT self-heal, createUser
// events) onto the Edge-safe slice in auth.config.ts. Middleware imports
// auth.config separately so the Edge runtime never tries to load Drizzle
// or the postgres-js driver.
import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { and, eq } from "drizzle-orm";
import { db } from "./db/client";
import {
  users,
  accounts,
  verificationTokens,
  stores,
  clientLanguages,
} from "./db/schema";
import { checkEmailAllowed } from "./domain";
import { authConfig } from "./auth.config";
import { writeAuditEntry } from "./audit-log";

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  // Providers live ONLY in the full Node-runtime config. The slim
  // auth.config slice has providers: [] because Resend pulls Node deps
  // (the `resend` SDK) that don't run in Edge middleware.
  providers: [
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.AUTH_EMAIL_FROM,
      // Custom sendVerificationRequest so we can ALSO log the magic-link
      // URL when DEV_LOG_MAGIC_LINKS=1 is set on the host. Pre-production
      // only — flip the env var off (or unset it) when dojo cuts over to
      // a real production audience. The email still goes out via Resend
      // exactly as before in both modes.
      async sendVerificationRequest({ identifier, url, provider }) {
        if (process.env.DEV_LOG_MAGIC_LINKS === "1") {
          // Single-line, grep-friendly. Iris pulls this via the Railway
          // deploymentLogs GraphQL query.
          console.log(`DEV_MAGIC_LINK email=${identifier} url=${url}`);
        }
        const apiKey = provider.apiKey as string | undefined;
        const from = provider.from as string | undefined;
        if (!apiKey || !from) {
          throw new Error(
            "AUTH_RESEND_KEY or AUTH_EMAIL_FROM is missing — cannot send magic link",
          );
        }
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: identifier,
            subject: "Sign in to Dojo",
            text: `Sign in to Dojo:\n\n${url}\n\nThis link expires in 24 hours. If you didn't request this, you can ignore this email.`,
            html: `<p>Sign in to Dojo by clicking the link below:</p><p><a href="${url}">${url}</a></p><p>This link expires in 24 hours. If you didn't request this, you can ignore this email.</p>`,
          }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(
            `Resend send failed: ${res.status} ${res.statusText} ${body}`,
          );
        }
      },
    }),
  ],
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    verificationTokensTable: verificationTokens,
  }),
  events: {
    async createUser({ user }) {
      // Resolve client_id from email domain on first sign-in.
      // Admins get role='admin', client_id=null.
      // Employees get role='employee', client_id from the allowed-domain match.
      if (!user.email) return;
      const result = await checkEmailAllowed(user.email);
      if (result.kind === "admin") {
        await db
          .update(users)
          .set({ role: "admin", clientId: null })
          .where(eq(users.id, user.id!));
      } else if (result.kind === "employee") {
        await db
          .update(users)
          .set({ role: "employee", clientId: result.clientId })
          .where(eq(users.id, user.id!));
      }
    },
  },
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      if (!user.email) return false;
      const result = await checkEmailAllowed(user.email);
      return result.kind !== "rejected";
    },
    async jwt({ token, user, trigger }) {
      // Refresh user fields from DB on:
      //   - sign-in (user is set)
      //   - explicit unstable_update() call (trigger === 'update')
      //   - any request where the JWT is missing core claims (no role yet,
      //     or no uid — i.e., the cookie predates the current schema)
      const needsRefresh =
        !!user?.id ||
        trigger === "update" ||
        token.role === undefined ||
        token.uid === undefined;
      if (!needsRefresh) return token;

      const id = (user?.id ?? token.sub) as string | undefined;
      if (!id) return token;

      const [row] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      if (!row) return token;

      // Self-heal: `events.createUser` is fire-and-forget in Auth.js v5,
      // so on the very first sign-in the JWT callback may run before that
      // event sets role/client_id. Re-derive them from the email here
      // (idempotent — same logic as events.createUser).
      //
      // Only invoke checkEmailAllowed (an extra DB read) when the row
      // genuinely looks stale: a non-admin user with no clientId, OR an
      // admin row that still has a clientId set. This avoids paying the
      // domain-check round-trip on every refresh and removes the latent
      // role-flip hazard where an admin's email accidentally added to a
      // client's allowed-domains row would silently demote them.
      let role = row.role;
      let clientId = row.clientId;
      const looksStale =
        (role !== "admin" && clientId === null) ||
        (role === "admin" && clientId !== null);
      if (looksStale && row.email) {
        const allowed = await checkEmailAllowed(row.email);
        if (allowed.kind === "admin") {
          role = "admin";
          clientId = null;
          await db
            .update(users)
            .set({ role, clientId, updatedAt: new Date() })
            .where(eq(users.id, row.id));
        } else if (allowed.kind === "employee") {
          role = "employee";
          clientId = allowed.clientId;
          await db
            .update(users)
            .set({ role, clientId, updatedAt: new Date() })
            .where(eq(users.id, row.id));
        }
      }

      // Auto re-onboarding (#3): if an employee's selected store no longer
      // exists / isn't active, OR their preferred language has been removed
      // from their client's allowed languages, clear onboardingCompleted so
      // middleware routes them back through /onboarding on the next
      // request. Catches CSV-driven store deletions and admin-driven
      // language removals without an explicit admin button — the employee
      // self-fixes on next session refresh. Only runs for employees with a
      // clientId who currently look onboarded; admins and unauthed users
      // skip the check.
      let onboardingCompleted = row.onboardingCompleted;
      let storeId = row.storeId;
      let preferredLanguage = row.preferredLanguage;
      if (role === "employee" && clientId && onboardingCompleted) {
        const [storeOk, langOk] = await Promise.all([
          storeId
            ? db
                .select({ id: stores.id })
                .from(stores)
                .where(and(eq(stores.id, storeId), eq(stores.isActive, true)))
                .limit(1)
                .then((r) => r.length > 0)
            : Promise.resolve(false),
          db
            .select({ language: clientLanguages.language })
            .from(clientLanguages)
            .where(
              and(
                eq(clientLanguages.clientId, clientId),
                eq(clientLanguages.language, preferredLanguage),
              ),
            )
            .limit(1)
            .then((r) => r.length > 0),
        ]);
        if (!storeOk || !langOk) {
          const patch: Partial<typeof users.$inferInsert> = {
            onboardingCompleted: false,
            updatedAt: new Date(),
          };
          if (!storeOk) patch.storeId = null;
          if (!langOk) patch.preferredLanguage = "en";
          await db.update(users).set(patch).where(eq(users.id, row.id));
          // Audit as a system action (no actor) — useful when investigating
          // why an employee unexpectedly hit onboarding.
          await writeAuditEntry({
            action: "employee.auto_reonboarding",
            targetType: "user",
            targetId: row.id,
            payload: { storeOk, langOk, previousStoreId: storeId, previousLanguage: preferredLanguage },
            actorUserId: null,
          });
          onboardingCompleted = false;
          if (!storeOk) storeId = null;
          if (!langOk) preferredLanguage = "en";
        }
      }

      token.uid = row.id;
      token.role = role;
      token.clientId = clientId;
      token.onboardingCompleted = onboardingCompleted;
      token.preferredLanguage = preferredLanguage;
      token.storeId = storeId;
      // Serialise as epoch ms so the Edge-safe slim config can read it
      // without importing Date.
      token.storeConfirmedAt = row.storeConfirmedAt
        ? row.storeConfirmedAt.getTime()
        : null;
      token.subtitlesEnabled = row.subtitlesEnabled;
      return token;
    },
  },
});
