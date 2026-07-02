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
// fast — no DB reads beyond the assignment check, except when a
// lesson_completed event triggers the group-completion detector below.

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { scopedDb } from "@/lib/db/scoped";

// Event types accepted from clients. `rating_submitted` was the legacy
// per-lesson rating signal and is no longer accepted — rating now lives in
// POST /api/groups/[id]/rate. Per-lesson upvote/unvote writes go through
// /api/lessons/[id]/upvote, not this endpoint. `group_rated` is written by
// the rate endpoint, not from client beacons.
const KNOWN_EVENTS = [
  "lesson_opened",
  "lesson_completed",
  "lesson_engagement",
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
  // Admins viewing a lesson don't count in analytics — silently no-op so
  // their dwell + ratings don't pollute employee metrics. Pandas team
  // shouldn't be a row in any client's funnel.
  if (session.user.role === "admin") {
    return NextResponse.json({ ok: true, skipped: "admin" });
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
    const written = await sdb.events.write(
      id,
      parsed.data.type,
      parsed.data.payload ?? null,
    );

    // After a lesson_completed write, run the success-celebration detectors
    // and merge any that fired into the response for the watch shell.
    //
    // groupCompletion is point-in-time and idempotent: re-completing the same
    // lesson keeps returning the same payload so a returning, not-yet-rated
    // viewer is still routed to the group-rating celebration (the client uses
    // `alreadyRated` to suppress the prompt on subsequent views). It runs on
    // every completion.
    //
    // firstThreeComplete and tierUnlocked are once-per-milestone signals, so
    // they only run on a genuinely NEW completion (alreadyExisted === false);
    // re-completing a lesson never re-fires them. Each returns null unless its
    // milestone just landed.
    if (parsed.data.type === "lesson_completed") {
      const [groupCompleted, firstThreeComplete, tierUnlocked] =
        await Promise.all([
          sdb.groupCompletion.detectForLesson(id),
          written.alreadyExisted
            ? Promise.resolve(null)
            : sdb.firstThreeComplete.detectForLesson(id),
          written.alreadyExisted
            ? Promise.resolve(null)
            : sdb.tierCrossing.detectForLesson(id),
        ]);
      if (groupCompleted || firstThreeComplete || tierUnlocked) {
        return NextResponse.json({
          ok: true,
          ...(groupCompleted ? { groupCompleted } : {}),
          ...(firstThreeComplete ? { firstThreeComplete } : {}),
          ...(tierUnlocked ? { tierUnlocked } : {}),
        });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[event] err="${msg}" user=${session.user.id} clientId=${session.user.clientId} lessonId=${id} type=${parsed.data.type}`,
      err,
    );
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
