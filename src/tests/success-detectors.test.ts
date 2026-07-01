// Integration test — the two new success-celebration detectors that ride on
// the lesson_completed path alongside groupCompletion:
//
//   scopedDb.events.write            → now returns { id, alreadyExisted }
//   scopedDb.firstThreeComplete      → fires once at the 3rd distinct completion
//   scopedDb.tierCrossing            → fires when a completion crosses a tier
//
// Requires a real Postgres connection via DATABASE_URL (use Railway's
// DATABASE_PUBLIC_URL locally), same as tenant-isolation.test.ts. Seeds an
// isolated client with 4 published, assigned lessons and CLIENT-SPECIFIC tiers
// at 0 / 0.5 / 1.0 so tier progression is deterministic and never depends on
// whatever global lesson_tiers rows happen to exist.
//
//   4 assigned+published lessons, tiers {Apprentice:0, Specialist:0.5, Expert:1.0}
//   completion #1 → 1/4 = .25  Apprentice   (no cross, no first-three)
//   completion #2 → 2/4 = .50  Specialist   (CROSS → Specialist)
//   completion #3 → 3/4 = .75  Specialist   (first-three fires; no cross)
//   completion #4 → 4/4 = 1.0  Expert       (CROSS → Expert)

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import {
  clients,
  clientLessons,
  lessons,
  lessonTiers,
  users,
} from "@/lib/db/schema";
import { scopedDb } from "@/lib/db/scoped";

const DB_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const skipReason =
  DB_URL?.includes("placeholder") || !DB_URL
    ? "DATABASE_URL not set (or placeholder) — skipping success-detectors test"
    : null;

describe.skipIf(skipReason !== null)("success detectors", () => {
  let sql: postgres.Sql;
  let db: ReturnType<typeof drizzle>;
  let client: typeof clients.$inferSelect;
  let user: typeof users.$inferSelect;
  const lessonIds: string[] = [];

  const sdb = () =>
    scopedDb({ id: user.id, clientId: client.id, role: "employee" });

  beforeAll(async () => {
    sql = postgres(DB_URL!, { max: 2, prepare: false });
    db = drizzle(sql);

    const stamp = Date.now();
    [client] = await db
      .insert(clients)
      .values({ name: "Success Detectors Test", slug: `sdt-${stamp}` })
      .returning();

    [user] = await db
      .insert(users)
      .values({
        clientId: client.id,
        email: `sdt-user-${stamp}@sdt.test`,
        role: "employee",
        onboardingCompleted: true,
      })
      .returning();

    // 4 published, assigned, ungrouped lessons — the tier denominator.
    for (let i = 1; i <= 4; i++) {
      const [lesson] = await db
        .insert(lessons)
        .values({
          internalName: `SDT Lesson ${i}`,
          isPublished: true,
          sortOrder: i * 10,
        })
        .returning();
      lessonIds.push(lesson.id);
      await db
        .insert(clientLessons)
        .values({ clientId: client.id, lessonId: lesson.id });
    }

    // Client-specific ladder so getTierConfig(client.id) resolves these and
    // ignores any global rows. Thresholds chosen to cross at #2 and #4.
    await db.insert(lessonTiers).values([
      { clientId: client.id, name: "Apprentice", emoji: "🌱", minPct: 0, sortOrder: 0 },
      { clientId: client.id, name: "Specialist", emoji: "⚡", minPct: 0.5, sortOrder: 1 },
      { clientId: client.id, name: "Expert", emoji: "🏆", minPct: 1.0, sortOrder: 2 },
    ]);
  });

  afterAll(async () => {
    await db.delete(lessonTiers).where(eq(lessonTiers.clientId, client.id));
    for (const id of lessonIds) {
      await db.delete(lessons).where(eq(lessons.id, id));
    }
    if (user) await db.delete(users).where(eq(users.id, user.id));
    if (client) await db.delete(clients).where(eq(clients.id, client.id));
    await sql.end();
  });

  it("events.write returns alreadyExisted:false on the first completion", async () => {
    const res = await sdb().events.write(lessonIds[0], "lesson_completed", null);
    expect(res.alreadyExisted).toBe(false);
    expect(typeof res.id).toBe("string");
  });

  it("events.write returns alreadyExisted:true when re-completing the same lesson", async () => {
    const res = await sdb().events.write(lessonIds[0], "lesson_completed", null);
    expect(res.alreadyExisted).toBe(true);
  });

  it("events.write returns alreadyExisted:false for non-dedupable lesson_engagement", async () => {
    const res = await sdb().events.write(lessonIds[0], "lesson_engagement", null);
    expect(res.alreadyExisted).toBe(false);
  });

  it("completion #1: no first-three, no tier crossing (Apprentice → Apprentice)", async () => {
    // lessonIds[0] already completed above (count = 1).
    expect(await sdb().firstThreeComplete.detectForLesson(lessonIds[0])).toBeNull();
    expect(await sdb().tierCrossing.detectForLesson(lessonIds[0])).toBeNull();
  });

  it("completion #2 crosses into Specialist and does not fire first-three", async () => {
    await sdb().events.write(lessonIds[1], "lesson_completed", null);
    expect(await sdb().firstThreeComplete.detectForLesson(lessonIds[1])).toBeNull();
    const cross = await sdb().tierCrossing.detectForLesson(lessonIds[1]);
    expect(cross).not.toBeNull();
    expect(cross!.tierName).toBe("Specialist");
    expect(cross!.tierEmoji).toBe("⚡");
    expect(typeof cross!.tierId).toBe("string");
    expect(cross!.trainingComplete).toBe(false);
  });

  it("completion #3 fires first-three and does not cross a tier", async () => {
    await sdb().events.write(lessonIds[2], "lesson_completed", null);
    const three = await sdb().firstThreeComplete.detectForLesson(lessonIds[2]);
    expect(three).toEqual({ totalCompleted: 3 });
    expect(await sdb().tierCrossing.detectForLesson(lessonIds[2])).toBeNull();
  });

  it("completion #4 crosses into Expert, flags trainingComplete, first-three no longer fires", async () => {
    await sdb().events.write(lessonIds[3], "lesson_completed", null);
    expect(await sdb().firstThreeComplete.detectForLesson(lessonIds[3])).toBeNull();
    const cross = await sdb().tierCrossing.detectForLesson(lessonIds[3]);
    expect(cross).not.toBeNull();
    expect(cross!.tierName).toBe("Expert");
    expect(cross!.tierEmoji).toBe("🏆");
    expect(cross!.trainingComplete).toBe(true);
  });
});
