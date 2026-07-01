// One-off fixture seed for the employee /browse design review.
//
// Why this exists: production has 7 published lessons, all ungrouped and
// assigned to Orange Belgium, so /browse renders a single "More lessons" rail.
// Design review needs a populated, multi-rail page. This script creates a set
// of named editorial groups and fills each with a handful of lessons that
// REUSE the real media of the existing 7 lessons (Mux playback ids, image
// urls, carousel slides) — so every new card renders a real poster, never an
// empty "processing" placeholder.
//
// It is deliberately additive and idempotent:
//   - groups are keyed by name; an existing group is reused, not duplicated
//   - lessons are keyed by a deterministic internal_name (`fixture-<slug>-<n>`);
//     an existing fixture lesson is left untouched
//   - client_lessons / translations use ON CONFLICT DO NOTHING
//   - audit-log rows are written only for rows this run actually creates
// Re-running is safe and writes nothing new on a fully-seeded DB.
//
// Run:  DATABASE_URL=<railway public url> npx tsx src/scripts/seed-browse-fixtures.ts
import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, inArray, isNull } from "drizzle-orm";
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

// Internal names of the 7 source lessons whose media we recycle. Read live so
// we never hardcode (and risk drifting from) Mux ids / slide arrays.
const SOURCE_NAMES = [
  "vision-ai-overview",
  "trade-in-flow",
  "customer-handoff",
  "battery-health-quick-tip",
  "csv-deadline-reminder",
  "onboarding-checklist",
  "common-pitfalls",
];

type ContentType = "video" | "image" | "carousel";

// Resolved media template lifted from a source lesson's translation.
type Media = {
  source: string;
  contentType: ContentType;
  muxPlaybackId: string | null;
  muxAssetId: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  carouselSlides: CarouselSlide[] | null;
  aspectRatio: number | null;
};

// Editorial groups + their lessons. Each lesson names only an editorial title
// and a content type; the actual media is round-robin-borrowed from a source
// lesson of that type, so every rail mixes video / image / carousel posters.
const GROUPS: {
  name: string;
  sortOrder: number;
  slug: string;
  lessons: { title: string; contentType: ContentType }[];
}[] = [
  {
    name: "Managing the store",
    sortOrder: 10,
    slug: "managing-the-store",
    lessons: [
      { title: "Opening the store checklist", contentType: "carousel" },
      { title: "Daily cash handling", contentType: "video" },
      { title: "Stockroom organization", contentType: "image" },
      { title: "Closing procedures", contentType: "video" },
      { title: "Health & safety basics", contentType: "image" },
    ],
  },
  {
    name: "Customer flows",
    sortOrder: 20,
    slug: "customer-flows",
    lessons: [
      { title: "Greeting a walk-in customer", contentType: "video" },
      { title: "Customer handoff between staff", contentType: "carousel" },
      { title: "Handling a complaint", contentType: "image" },
      { title: "Upselling accessories", contentType: "video" },
    ],
  },
  {
    name: "Vision AI basics",
    sortOrder: 30,
    slug: "vision-ai-basics",
    lessons: [
      { title: "What is Vision AI", contentType: "video" },
      { title: "Running your first scan", contentType: "carousel" },
      { title: "Reading the scan result", contentType: "image" },
      { title: "Vision AI troubleshooting", contentType: "video" },
      { title: "Edge cases & retries", contentType: "carousel" },
      { title: "Accuracy tips", contentType: "image" },
    ],
  },
  {
    name: "Trade-in process",
    sortOrder: 40,
    slug: "trade-in-process",
    lessons: [
      { title: "Trade-in step by step", contentType: "carousel" },
      { title: "Quoting a fair price", contentType: "video" },
      { title: "Battery health check", contentType: "image" },
      { title: "Completing the trade-in", contentType: "video" },
    ],
  },
  {
    name: "Repair workflows",
    sortOrder: 50,
    slug: "repair-workflows",
    lessons: [
      { title: "Intake & diagnosis", contentType: "image" },
      { title: "Screen replacement walkthrough", contentType: "video" },
      { title: "Repair QA checklist", contentType: "carousel" },
      { title: "Logging the repair", contentType: "image" },
      { title: "Returning the device", contentType: "video" },
    ],
  },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const sql = postgres(url, { max: 1, prepare: false });
  const db = drizzle(sql);

  let createdGroups = 0;
  let createdLessons = 0;

  console.log("Seeding /browse fixtures…");

  // 0. Resolve the tenant.
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.slug, CLIENT_SLUG));
  if (!client) throw new Error(`client not found: ${CLIENT_SLUG}`);

  // 1. Build the media pool from the source lessons' translations.
  const sourceLessons = await db
    .select()
    .from(lessons)
    .where(inArray(lessons.internalName, SOURCE_NAMES));
  if (sourceLessons.length === 0) {
    throw new Error("no source lessons found — nothing to recycle media from");
  }
  const sourceTr = await db
    .select()
    .from(lessonTranslations)
    .where(
      and(
        inArray(
          lessonTranslations.lessonId,
          sourceLessons.map((l) => l.id),
        ),
        eq(lessonTranslations.language, LANG),
      ),
    );
  const trByLesson = new Map(sourceTr.map((t) => [t.lessonId, t]));

  const pool: Record<ContentType, Media[]> = {
    video: [],
    image: [],
    carousel: [],
  };
  for (const l of sourceLessons) {
    const t = trByLesson.get(l.id);
    if (!t) continue;
    pool[l.contentType as ContentType].push({
      source: l.internalName,
      contentType: l.contentType as ContentType,
      muxPlaybackId: t.muxPlaybackId,
      muxAssetId: t.muxAssetId,
      durationSeconds: t.durationSeconds,
      thumbnailUrl: t.thumbnailUrl,
      imageUrl: t.imageUrl,
      imageAlt: t.imageAlt,
      carouselSlides: t.carouselSlides ?? null,
      aspectRatio: t.aspectRatio,
    });
  }
  for (const ct of ["video", "image", "carousel"] as ContentType[]) {
    if (pool[ct].length === 0) {
      throw new Error(`media pool empty for content type "${ct}"`);
    }
    console.log(`  media pool · ${ct}: ${pool[ct].length} source(s)`);
  }
  const cursor: Record<ContentType, number> = {
    video: 0,
    image: 0,
    carousel: 0,
  };
  const nextMedia = (ct: ContentType): Media => {
    const arr = pool[ct];
    const m = arr[cursor[ct] % arr.length];
    cursor[ct] += 1;
    return m;
  };

  // 2. Upsert groups + their lessons. globalSort keeps fixture lessons after
  // the original 7 in the admin master list (their sort_order is 10..70).
  let globalSort = 200;
  for (const g of GROUPS) {
    let [group] = await db
      .select()
      .from(lessonGroups)
      .where(eq(lessonGroups.name, g.name));
    if (!group) {
      [group] = await db
        .insert(lessonGroups)
        .values({ name: g.name, sortOrder: g.sortOrder })
        .returning();
      createdGroups += 1;
      await db.insert(adminAuditLog).values({
        actorUserId: null,
        action: "fixture.group.create",
        targetType: "lesson_group",
        targetId: group.id,
        payload: { name: g.name, sortOrder: g.sortOrder, via: "seed-browse-fixtures" },
      });
      console.log(`  + group: ${g.name} (sort ${g.sortOrder})`);
    } else {
      console.log(`  = group exists: ${g.name}`);
    }

    let groupPos = 0;
    for (let i = 0; i < g.lessons.length; i++) {
      const spec = g.lessons[i];
      const internalName = `fixture-${g.slug}-${i + 1}`;
      const media = nextMedia(spec.contentType);
      globalSort += 1;
      const thisGlobalSort = globalSort;
      const thisGroupPos = (groupPos += 10);

      const [existing] = await db
        .select()
        .from(lessons)
        .where(eq(lessons.internalName, internalName));

      let lessonId: string;
      if (!existing) {
        const [row] = await db
          .insert(lessons)
          .values({
            internalName,
            type: "training",
            contentType: spec.contentType,
            sortOrder: thisGlobalSort,
            groupId: group.id,
            groupSortOrder: thisGroupPos,
            isPublished: true,
          })
          .returning();
        lessonId = row.id;
        createdLessons += 1;
        await db.insert(adminAuditLog).values({
          actorUserId: null,
          action: "fixture.lesson.create",
          targetType: "lesson",
          targetId: lessonId,
          payload: {
            internalName,
            title: spec.title,
            contentType: spec.contentType,
            groupId: group.id,
            groupName: g.name,
            mediaSource: media.source,
            via: "seed-browse-fixtures",
          },
        });
        console.log(
          `    + lesson: ${spec.title} [${spec.contentType}] ⟵ ${media.source}`,
        );
      } else {
        lessonId = existing.id;
        // Keep an existing fixture lesson pinned to its group/order in case a
        // prior run created it before this column layout settled.
        await db
          .update(lessons)
          .set({
            groupId: group.id,
            groupSortOrder: thisGroupPos,
            isPublished: true,
          })
          .where(eq(lessons.id, lessonId));
        console.log(`    = lesson exists: ${spec.title}`);
      }

      const fixtureNotes = `# ${spec.title}\n\nFixture notes for /browse design review. Replace with real content when the lesson is authored.\n\n- Key point one\n- Key point two\n- Key point three`;

      // Translation — copy the recycled media verbatim. ON CONFLICT (lesson,
      // lang) DO NOTHING so a re-run never clobbers hand-edits.
      await db
        .insert(lessonTranslations)
        .values({
          lessonId,
          language: LANG,
          title: spec.title,
          description: `${g.name} · fixture lesson for /browse design review.`,
          notesMarkdown: fixtureNotes,
          muxPlaybackId: media.muxPlaybackId,
          muxAssetId: media.muxAssetId,
          durationSeconds: media.durationSeconds,
          thumbnailUrl: media.thumbnailUrl,
          imageUrl: media.imageUrl,
          imageAlt: media.imageAlt,
          carouselSlides: media.carouselSlides,
          aspectRatio: media.aspectRatio,
        })
        .onConflictDoNothing({
          target: [lessonTranslations.lessonId, lessonTranslations.language],
        });

      // Backfill notesMarkdown on pre-existing fixture rows that lack it, so
      // "Learn more" surfaces. Guarded on IS NULL to protect hand-edits.
      await db
        .update(lessonTranslations)
        .set({ notesMarkdown: fixtureNotes })
        .where(
          and(
            eq(lessonTranslations.lessonId, lessonId),
            eq(lessonTranslations.language, LANG),
            isNull(lessonTranslations.notesMarkdown),
          ),
        );

      // Assign to the tenant.
      await db
        .insert(clientLessons)
        .values({ clientId: client.id, lessonId })
        .onConflictDoNothing();
    }
  }

  console.log(
    `Done. created ${createdGroups} group(s), ${createdLessons} lesson(s). ` +
      `(re-runs are idempotent)`,
  );
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
