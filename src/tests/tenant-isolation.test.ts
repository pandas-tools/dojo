// Integration test — proves that scopedDb(user) cannot read or mutate
// data outside the user's client. Requires a real Postgres connection
// via DATABASE_URL (use Railway's DATABASE_PUBLIC_URL locally).
//
// Run with:  npm run test
//
// Test plan:
//   1. Seed two clients (A and B) with one user + one published lesson each
//   2. Verify userA's scopedDb sees only A's lesson; not B's
//   3. Verify userA cannot complete B's lesson (scopedDb throws)
//   4. Cleanup

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import {
  clients,
  clientAllowedDomains,
  clientLessons,
  lessons,
  lessonGroups,
  lessonTranslations,
  users,
} from "@/lib/db/schema";
import { scopedDb } from "@/lib/db/scoped";

const DB_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const skipReason = DB_URL?.includes("placeholder") || !DB_URL
  ? "DATABASE_URL not set (or placeholder) — skipping tenant isolation test"
  : null;

describe.skipIf(skipReason !== null)("tenant isolation", () => {
  let sql: postgres.Sql;
  let db: ReturnType<typeof drizzle>;
  let clientA: typeof clients.$inferSelect;
  let clientB: typeof clients.$inferSelect;
  let userA: typeof users.$inferSelect;
  let lessonA: typeof lessons.$inferSelect;
  let lessonB: typeof lessons.$inferSelect;
  let groupA: typeof lessonGroups.$inferSelect;
  let groupB: typeof lessonGroups.$inferSelect;

  beforeAll(async () => {
    sql = postgres(DB_URL!, { max: 2, prepare: false });
    db = drizzle(sql);

    // Seed two clients
    [clientA] = await db
      .insert(clients)
      .values({ name: "Test A", slug: `test-a-${Date.now()}` })
      .returning();
    [clientB] = await db
      .insert(clients)
      .values({ name: "Test B", slug: `test-b-${Date.now()}` })
      .returning();

    await db.insert(clientAllowedDomains).values([
      { clientId: clientA.id, domain: `a-${Date.now()}.test` },
      { clientId: clientB.id, domain: `b-${Date.now()}.test` },
    ]);

    [userA] = await db
      .insert(users)
      .values({
        clientId: clientA.id,
        email: `userA-${Date.now()}@a.test`,
        role: "employee",
        onboardingCompleted: true,
      })
      .returning();

    // Group A + a single published, assigned lesson — drives the happy-path
    // group-rating tests (one-lesson groups complete on first lesson).
    [groupA] = await db
      .insert(lessonGroups)
      .values({ name: `Group A ${Date.now()}` })
      .returning();
    [lessonA] = await db
      .insert(lessons)
      .values({
        internalName: "Lesson A",
        isPublished: true,
        sortOrder: 10,
        groupId: groupA.id,
      })
      .returning();
    await db.insert(lessonTranslations).values({
      lessonId: lessonA.id,
      language: "en",
      title: "Lesson A (EN)",
      muxPlaybackId: "fake-playback-a",
      thumbnailUrl: "https://example.com/a.jpg",
    });
    await db
      .insert(clientLessons)
      .values({ clientId: clientA.id, lessonId: lessonA.id });

    // Group B + lesson B belong to client B only — used to prove userA
    // cannot rate B's group from their scoped wrapper.
    [groupB] = await db
      .insert(lessonGroups)
      .values({ name: `Group B ${Date.now()}` })
      .returning();
    [lessonB] = await db
      .insert(lessons)
      .values({
        internalName: "Lesson B",
        isPublished: true,
        sortOrder: 20,
        groupId: groupB.id,
      })
      .returning();
    await db.insert(lessonTranslations).values({
      lessonId: lessonB.id,
      language: "en",
      title: "Lesson B (EN)",
      muxPlaybackId: "fake-playback-b",
    });
    await db
      .insert(clientLessons)
      .values({ clientId: clientB.id, lessonId: lessonB.id });
  });

  afterAll(async () => {
    // Cleanup
    if (lessonA) await db.delete(lessons).where(eq(lessons.id, lessonA.id));
    if (lessonB) await db.delete(lessons).where(eq(lessons.id, lessonB.id));
    if (groupA)
      await db.delete(lessonGroups).where(eq(lessonGroups.id, groupA.id));
    if (groupB)
      await db.delete(lessonGroups).where(eq(lessonGroups.id, groupB.id));
    if (userA) await db.delete(users).where(eq(users.id, userA.id));
    if (clientA) await db.delete(clients).where(eq(clients.id, clientA.id));
    if (clientB) await db.delete(clients).where(eq(clients.id, clientB.id));
    await sql.end();
  });

  it("userA's scoped lessons.list() includes A's lesson", async () => {
    const sdb = scopedDb({
      id: userA.id,
      clientId: clientA.id,
      role: "employee",
    });
    const list = await sdb.lessons.list();
    expect(list.map((l) => l.id)).toContain(lessonA.id);
  });

  it("userA's scoped lessons.list() does NOT include B's lesson", async () => {
    const sdb = scopedDb({
      id: userA.id,
      clientId: clientA.id,
      role: "employee",
    });
    const list = await sdb.lessons.list();
    expect(list.map((l) => l.id)).not.toContain(lessonB.id);
  });

  it("userA's scoped lessons.getById(B) returns null", async () => {
    const sdb = scopedDb({
      id: userA.id,
      clientId: clientA.id,
      role: "employee",
    });
    const got = await sdb.lessons.getById(lessonB.id);
    expect(got).toBeNull();
  });

  it("userA's scoped groupRatings.upsert on B's group throws", async () => {
    const sdb = scopedDb({
      id: userA.id,
      clientId: clientA.id,
      role: "employee",
    });
    await expect(sdb.groupRatings.upsert(groupB.id, 5)).rejects.toThrow(
      /no published, assigned lessons/i,
    );
  });

  it("userA's scoped groupRatings.upsert rejects out-of-range rating", async () => {
    const sdb = scopedDb({
      id: userA.id,
      clientId: clientA.id,
      role: "employee",
    });
    await expect(sdb.groupRatings.upsert(groupB.id, 0)).rejects.toThrow(
      /between 1 and 5/i,
    );
    await expect(sdb.groupRatings.upsert(groupB.id, 6)).rejects.toThrow(
      /between 1 and 5/i,
    );
  });

  it("userA's scoped groupCompletion.detectForLesson(B) returns null", async () => {
    const sdb = scopedDb({
      id: userA.id,
      clientId: clientA.id,
      role: "employee",
    });
    const result = await sdb.groupCompletion.detectForLesson(lessonB.id);
    expect(result).toBeNull();
  });

  it("userA's scoped groupRatings.upsert + forGroup happy path", async () => {
    const sdb = scopedDb({
      id: userA.id,
      clientId: clientA.id,
      role: "employee",
    });

    // First rate
    const first = await sdb.groupRatings.upsert(groupA.id, 4);
    expect(first).toEqual({ rating: 4, previousRating: null });

    const readBack = await sdb.groupRatings.forGroup(groupA.id);
    expect(readBack).toBe(4);

    // Re-rate updates previousRating + current state
    const second = await sdb.groupRatings.upsert(groupA.id, 5);
    expect(second).toEqual({ rating: 5, previousRating: 4 });
    const readBack2 = await sdb.groupRatings.forGroup(groupA.id);
    expect(readBack2).toBe(5);
  });

  it("userA's scoped groupCompletion.detectForLesson(A) returns groupCompleted after the only lesson is completed", async () => {
    const sdb = scopedDb({
      id: userA.id,
      clientId: clientA.id,
      role: "employee",
    });

    // Pre-state: no lesson_completed event yet → detector returns null.
    const before = await sdb.groupCompletion.detectForLesson(lessonA.id);
    expect(before).toBeNull();

    // Record the completion via the same scoped path the event route uses.
    await sdb.events.write(lessonA.id, "lesson_completed", null);

    const after = await sdb.groupCompletion.detectForLesson(lessonA.id);
    expect(after).not.toBeNull();
    expect(after!.groupId).toBe(groupA.id);
    expect(after!.groupName).toBe(groupA.name);
    expect(after!.lessonCount).toBe(1);
    // alreadyRated is a boolean reflecting whether userA has a rating row
    // for groupA at detection time. Not asserting a specific value here
    // because earlier tests may have written one — the contract under test
    // is just that the field is set and the rest of the payload is right.
    expect(typeof after!.alreadyRated).toBe("boolean");
  });

  it("userA's scoped translations.forLesson(B) returns null", async () => {
    const sdb = scopedDb({
      id: userA.id,
      clientId: clientA.id,
      role: "employee",
    });
    const t = await sdb.translations.forLesson(lessonB.id, "en");
    expect(t).toBeNull();
  });
});
