// Idempotent seed for the "Placeholder content" lesson group:
//
//   - 2 carousel lessons backed by /public/placeholders/carousels/{store,home}/
//   - 2 reel (video) lessons backed by Mux assets uploaded out-of-band via
//     src/scripts/upload-placeholder-reels.ts (playback ids hard-coded below).
//
// Run:  DATABASE_URL=<railway public url> npx tsx src/scripts/seed-placeholder-lessons.ts
//
// Re-runs are safe — group/lessons are keyed by name / internal_name and
// translations use ON CONFLICT DO NOTHING.

import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import {
  clients,
  clientLessons,
  lessons,
  lessonGroups,
  lessonTranslations,
  adminAuditLog,
  type CarouselSlide,
} from "../lib/db/schema";

const CLIENT_SLUG = "orange-belgium";
const LANG = "en";
const GROUP_NAME = "Placeholder content";
const GROUP_SORT = 100;

type CarouselSpec = {
  internalName: string;
  title: string;
  description: string;
  slides: CarouselSlide[];
  aspectRatio: number;
};

const CAROUSELS: CarouselSpec[] = [
  {
    internalName: "placeholder-carousel-store",
    title: "In the store",
    description: "Placeholder · what an in-store assessment moment looks like.",
    aspectRatio: 0.8, // 800x1000
    slides: [
      {
        url: "/placeholders/carousels/store/01-inspect.png",
        alt: "Customer inspecting a device in-store",
        caption: "Step 1 — visual condition check",
      },
      {
        url: "/placeholders/carousels/store/02-portrait.png",
        alt: "Retail employee portrait",
        caption: "Step 2 — meet your assessor",
      },
      {
        url: "/placeholders/carousels/store/03-counter.png",
        alt: "Employee running an assessment on a tablet at the counter",
        caption: "Step 3 — run the assessment",
      },
    ],
  },
  {
    internalName: "placeholder-carousel-home",
    title: "At home",
    description: "Placeholder · consumer trade-in moments at home.",
    aspectRatio: 0.8,
    slides: [
      {
        url: "/placeholders/carousels/home/01-grey-sofa.png",
        alt: "Customer comparing two phones at home",
        caption: "Compare the device they have with the one they want",
      },
      {
        url: "/placeholders/carousels/home/02-cream-sofa.png",
        alt: "Customer with two phones at home",
        caption: "Confirm the trade-in value before they walk in",
      },
    ],
  },
];

type ReelSpec = {
  internalName: string;
  title: string;
  description: string;
  muxPlaybackId: string;
  muxAssetId: string;
  durationSeconds: number;
  aspectRatio: number;
};

// Output of src/scripts/upload-placeholder-reels.ts on 2026-06-30.
const REELS: ReelSpec[] = [
  {
    internalName: "placeholder-reel-01",
    title: "Placeholder reel 01",
    description: "Placeholder vertical reel for the watch feed.",
    muxAssetId: "Qmc2ix00QiFRjAHUOh00M8e3Dp1XjhOsvujm2tzCFYPlk",
    muxPlaybackId: "549602EuXk4Cz84LGNf3UvOkQOC3PCWpuMNtfYYV9gk00",
    durationSeconds: 39,
    aspectRatio: 0.5625,
  },
  {
    internalName: "placeholder-reel-02",
    title: "Placeholder reel 02",
    description: "Placeholder vertical reel for the watch feed.",
    muxAssetId: "GgUk01FvIGTZ5KAMExoiBlKbenuqktBPZUWusoSHOuJM",
    muxPlaybackId: "egQ7n5f9gxLVXI8FRL00QiNWoGpjfybMgHKl5M02dSXo4",
    durationSeconds: 42,
    aspectRatio: 0.5625,
  },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 1, prepare: false });
  const db = drizzle(sql);

  console.log("Seeding placeholder lessons…");

  // Tenant.
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.slug, CLIENT_SLUG));
  if (!client) throw new Error(`client not found: ${CLIENT_SLUG}`);

  // Group.
  let [group] = await db
    .select()
    .from(lessonGroups)
    .where(eq(lessonGroups.name, GROUP_NAME));
  if (!group) {
    [group] = await db
      .insert(lessonGroups)
      .values({ name: GROUP_NAME, sortOrder: GROUP_SORT })
      .returning();
    await db.insert(adminAuditLog).values({
      actorUserId: null,
      action: "fixture.group.create",
      targetType: "lesson_group",
      targetId: group.id,
      payload: { name: GROUP_NAME, via: "seed-placeholder-lessons" },
    });
    console.log(`  + group: ${GROUP_NAME}`);
  } else {
    console.log(`  = group exists: ${GROUP_NAME}`);
  }

  let globalSort = 300;
  let groupPos = 0;

  const upsertLesson = async (
    spec: {
      internalName: string;
      title: string;
      description: string;
      contentType: "carousel" | "video";
    },
    translation: Partial<typeof lessonTranslations.$inferInsert>,
  ) => {
    globalSort += 1;
    groupPos += 10;

    const [existing] = await db
      .select()
      .from(lessons)
      .where(eq(lessons.internalName, spec.internalName));

    let lessonId: string;
    if (!existing) {
      const [row] = await db
        .insert(lessons)
        .values({
          internalName: spec.internalName,
          type: "training",
          contentType: spec.contentType,
          sortOrder: globalSort,
          groupId: group.id,
          groupSortOrder: groupPos,
          isPublished: true,
          publishedAt: new Date(),
        })
        .returning();
      lessonId = row.id;
      await db.insert(adminAuditLog).values({
        actorUserId: null,
        action: "fixture.lesson.create",
        targetType: "lesson",
        targetId: lessonId,
        payload: {
          internalName: spec.internalName,
          title: spec.title,
          contentType: spec.contentType,
          via: "seed-placeholder-lessons",
        },
      });
      console.log(`    + ${spec.contentType}: ${spec.title}`);
    } else {
      lessonId = existing.id;
      await db
        .update(lessons)
        .set({
          groupId: group.id,
          groupSortOrder: groupPos,
          isPublished: true,
        })
        .where(eq(lessons.id, lessonId));
      console.log(`    = ${spec.contentType} exists: ${spec.title}`);
    }

    await db
      .insert(lessonTranslations)
      .values({
        lessonId,
        language: LANG,
        title: spec.title,
        description: spec.description,
        ...translation,
      })
      .onConflictDoNothing({
        target: [lessonTranslations.lessonId, lessonTranslations.language],
      });

    await db
      .insert(clientLessons)
      .values({ clientId: client.id, lessonId })
      .onConflictDoNothing();
  };

  for (const c of CAROUSELS) {
    await upsertLesson(
      {
        internalName: c.internalName,
        title: c.title,
        description: c.description,
        contentType: "carousel",
      },
      {
        carouselSlides: c.slides,
        aspectRatio: c.aspectRatio,
      },
    );
  }

  for (const r of REELS) {
    await upsertLesson(
      {
        internalName: r.internalName,
        title: r.title,
        description: r.description,
        contentType: "video",
      },
      {
        muxPlaybackId: r.muxPlaybackId,
        muxAssetId: r.muxAssetId,
        durationSeconds: r.durationSeconds,
        aspectRatio: r.aspectRatio,
      },
    );
  }

  console.log("Done.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
