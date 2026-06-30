import { NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { checkEmailAllowed } from "@/lib/domain";
import { db } from "@/lib/db/client";
import { clientLanguages, stores } from "@/lib/db/schema";

/**
 * Pre-auth context for the 3-step login wizard. Given an email, returns
 * the stores + supported languages for the user's client so the wizard
 * can render the picker steps WITHOUT requiring a session yet.
 *
 * Mirrors check-domain — generic "rejected" response if the domain isn't
 * allowed (don't leak which clients we serve). Admin emails get an empty
 * store/language set (they go to /admin, not the employee wizard).
 */
const bodySchema = z.object({
  email: z.string().email(),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const result = await checkEmailAllowed(parsed.data.email);
  if (result.kind === "rejected") {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  if (result.kind === "admin") {
    return NextResponse.json({
      ok: true,
      role: "admin" as const,
      stores: [],
      languages: [],
    });
  }
  const [storeRows, langRows] = await Promise.all([
    db
      .select({ id: stores.id, name: stores.name, city: stores.city })
      .from(stores)
      .where(and(eq(stores.clientId, result.clientId), eq(stores.isActive, true)))
      .orderBy(asc(stores.name)),
    db
      .select({ language: clientLanguages.language })
      .from(clientLanguages)
      .where(eq(clientLanguages.clientId, result.clientId)),
  ]);
  const languages = langRows.length
    ? langRows.map((r) => r.language)
    : ["en"];
  return NextResponse.json({
    ok: true,
    role: "employee" as const,
    stores: storeRows,
    languages,
  });
}
