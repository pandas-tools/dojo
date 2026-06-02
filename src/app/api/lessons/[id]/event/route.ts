// Lesson-event ingestion endpoint. The Reels-shell tracker POSTs here from
// the browser for every lesson_opened / lesson_completed / lesson_engagement
// the user produces while watching, dwelling on, or swiping through a lesson.
//
// Auth-gated to the employee session. tenant-scoped via scopedDb — the route
// won't write an event for a lesson the user's client doesn't have assigned
// (defensive: scopedDb.events.write checks this).
//
// Most paths are called from `navigator.sendBeacon` on pagehide /
// visibilitychange-hidden, so the response must be small and the handler
// fast — no DB reads beyond the assignment check.

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { scopedDb } from "@/lib/db/scoped";

const KNOWN_EVENTS = [
  "lesson_opened",
  "lesson_completed",
  "lesson_engagement",
  "rating_submitted",
] as const;

const bodySchema = z.object({
  type: z.enum(KNOWN_EVENTS),
  // Free-shape per event type. Tracker emits typed payloads but we accept
  // any JSON-serialisable object so we can extend events without server
  // changes.
  payload: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || !session.user.clientId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const sdb = scopedDb({
      id: session.user.id,
      clientId: session.user.clientId,
      role: "employee",
    });
    await sdb.events.write(id, parsed.data.type, parsed.data.payload ?? null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
