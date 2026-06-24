"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth, unstable_update } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { users, stores, clientLanguages } from "@/lib/db/schema";

export async function updatePreferredLanguage(language: string) {
  const session = await auth();
  if (!session?.user?.id || session.user.role === "admin") {
    return { error: "unauthorized" } as const;
  }
  if (!session.user.clientId) return { error: "unauthorized" } as const;

  // Must be one of the client's allowed languages
  const allowed = await db
    .select({ language: clientLanguages.language })
    .from(clientLanguages)
    .where(eq(clientLanguages.clientId, session.user.clientId));
  if (!allowed.some((a) => a.language === language)) {
    return { error: "invalid language" } as const;
  }

  await db
    .update(users)
    .set({ preferredLanguage: language, updatedAt: new Date() })
    .where(eq(users.id, session.user.id));

  await unstable_update({ user: { preferredLanguage: language } });
  revalidatePath("/profile");
  revalidatePath("/browse");
  return { ok: true } as const;
}

export async function updateStore(storeId: string) {
  const session = await auth();
  if (!session?.user?.id || session.user.role === "admin") {
    return { error: "unauthorized" } as const;
  }
  if (!session.user.clientId) return { error: "unauthorized" } as const;

  // Validate the store belongs to this user's client
  const [store] = await db.select().from(stores).where(eq(stores.id, storeId));
  if (!store || store.clientId !== session.user.clientId) {
    return { error: "invalid store" } as const;
  }

  const now = new Date();
  await db
    .update(users)
    .set({ storeId, storeConfirmedAt: now, updatedAt: now })
    .where(eq(users.id, session.user.id));

  await unstable_update({
    user: { storeId, storeConfirmedAt: now.getTime() },
  });
  revalidatePath("/profile");
  return { ok: true } as const;
}
