"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { scopedDb } from "@/lib/db/scoped";

/**
 * Toggle the current employee's bookmark on a lesson. Returns the resulting
 * state — { bookmarked: true } after saving, { bookmarked: false } after
 * removing — so the client can reflect it without a refetch. Failures (not a
 * signed-in employee, or the lesson isn't assigned to the user's client) come
 * back as { error }. Tenant scoping + the assignment check live in
 * scopedDb.bookmarks.toggle; this action is just the auth gate around it.
 */
export async function toggleBookmark(
  lessonId: string,
): Promise<{ bookmarked: boolean } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id || session.user.role === "admin") {
    return { error: "unauthorized" };
  }
  if (!session.user.clientId) {
    return { error: "unauthorized" };
  }
  try {
    const sdb = scopedDb({
      id: session.user.id,
      clientId: session.user.clientId,
      role: "employee",
    });
    const res = await sdb.bookmarks.toggle(lessonId);
    revalidatePath("/browse");
    return res;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "failed" };
  }
}
