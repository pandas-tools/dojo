"use server";

// Admin server actions backing the "Preview as <client>" surface (#6).
//
// Two entry points:
//   - createClientPreviewLink({ clientId })            → /preview/<token>/browse
//   - createLessonPreviewLink({ lessonId })            → /preview/<token>/watch/<lessonId>
//
// Both return a fully-qualified URL the admin can paste into their phone.
// Tokens are signed (see src/lib/preview-tokens.ts) and expire in 24h.
// Generation is audit-logged so we can see who handed out preview links.

import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  clients,
  lessons,
  clientLessons,
} from "@/lib/db/schema";
import { createPreviewToken, previewUrl } from "@/lib/preview-tokens";
import { writeAuditEntry } from "@/lib/audit-log";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("forbidden");
  }
  return session;
}

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function createClientPreviewLink(input: { clientId: string }) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" };
  }
  const [client] = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(eq(clients.id, input.clientId))
    .limit(1);
  if (!client) return { error: "Client not found" };

  const token = createPreviewToken({ clientId: client.id });
  const url = previewUrl({ baseUrl: baseUrl(), token });

  await writeAuditEntry({
    action: "preview.client_link_created",
    targetType: "client",
    targetId: client.id,
    payload: { clientName: client.name },
  });

  return { ok: true as const, url };
}

/**
 * Build a preview link for a specific lesson. The token encodes the
 * lesson's owning client so the preview page renders the lesson exactly
 * as that client's employees would see it (correct assigned-lessons
 * context + correct preferred-language fallback resolution).
 *
 * If the lesson is assigned to MULTIPLE clients, the admin picks one via
 * the optional `clientId` arg. Without it, we default to the first
 * client_lessons row — fine for typical cases where a lesson is only
 * assigned to one client.
 */
export async function createLessonPreviewLink(input: {
  lessonId: string;
  clientId?: string;
}) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" };
  }
  const [lesson] = await db
    .select({ id: lessons.id, internalName: lessons.internalName })
    .from(lessons)
    .where(eq(lessons.id, input.lessonId))
    .limit(1);
  if (!lesson) return { error: "Lesson not found" };

  let clientId = input.clientId;
  if (!clientId) {
    const [first] = await db
      .select({ clientId: clientLessons.clientId })
      .from(clientLessons)
      .where(eq(clientLessons.lessonId, lesson.id))
      .limit(1);
    if (!first) {
      return {
        error:
          "This lesson isn't assigned to any client yet — assign it before previewing",
      };
    }
    clientId = first.clientId;
  }

  const token = createPreviewToken({ clientId, lessonId: lesson.id });
  const url = previewUrl({ baseUrl: baseUrl(), token, lessonId: lesson.id });

  await writeAuditEntry({
    action: "preview.lesson_link_created",
    targetType: "lesson",
    targetId: lesson.id,
    payload: { internalName: lesson.internalName, clientId },
  });

  return { ok: true as const, url };
}
