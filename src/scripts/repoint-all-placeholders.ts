// One-off: repoint every existing video / image / carousel lesson to use the
// new placeholder media (5 portrait stills + 2 vertical reels + 2 curated
// carousels). Run after seed-placeholder-lessons.ts so the new media exists.
//
// Why: until real client content lands, we want EVERY surface (watch feed,
// browse rails, individual viewers) to show consistent, on-brand placeholders
// instead of a mix of historical demo media.
//
// Scope:
//   - touches lessons of any name EXCEPT `placeholder-*` (already correct)
//     and `scratch-bulk-qa-*` (QA scratch space, leave alone).
//   - round-robin distribution across the new media pool, deterministic order
//     so re-runs produce the same mapping.
//   - rewrites only the en translation.
//
// Run:  DATABASE_URL=<railway public url> npx tsx src/scripts/repoint-all-placeholders.ts

import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, notLike, sql as dsql } from "drizzle-orm";
import {
  lessons,
  lessonTranslations,
  type CarouselSlide,
} from "../lib/db/schema";

const LANG = "en";

const REELS = [
  {
    muxAssetId: "Qmc2ix00QiFRjAHUOh00M8e3Dp1XjhOsvujm2tzCFYPlk",
    muxPlaybackId: "549602EuXk4Cz84LGNf3UvOkQOC3PCWpuMNtfYYV9gk00",
    durationSeconds: 39,
    aspectRatio: 0.5625,
  },
  {
    muxAssetId: "GgUk01FvIGTZ5KAMExoiBlKbenuqktBPZUWusoSHOuJM",
    muxPlaybackId: "egQ7n5f9gxLVXI8FRL00QiNWoGpjfybMgHKl5M02dSXo4",
    durationSeconds: 42,
    aspectRatio: 0.5625,
  },
];

const STILLS = [
  { url: "/placeholders/carousels/store/01-inspect.png",  alt: "Customer inspecting a device in-store" },
  { url: "/placeholders/carousels/store/02-portrait.png", alt: "Retail employee portrait" },
  { url: "/placeholders/carousels/store/03-counter.png",  alt: "Employee running an assessment on a tablet at the counter" },
  { url: "/placeholders/carousels/home/01-grey-sofa.png", alt: "Customer comparing two phones at home" },
  { url: "/placeholders/carousels/home/02-cream-sofa.png", alt: "Customer with two phones at home" },
];

const CAROUSEL_STORE: CarouselSlide[] = [
  { url: "/placeholders/carousels/store/01-inspect.png",  alt: "Customer inspecting a device in-store", caption: "Step 1 — visual condition check" },
  { url: "/placeholders/carousels/store/02-portrait.png", alt: "Retail employee portrait", caption: "Step 2 — meet your assessor" },
  { url: "/placeholders/carousels/store/03-counter.png",  alt: "Employee running an assessment on a tablet at the counter", caption: "Step 3 — run the assessment" },
];
const CAROUSEL_HOME: CarouselSlide[] = [
  { url: "/placeholders/carousels/home/01-grey-sofa.png", alt: "Customer comparing two phones at home", caption: "Compare the device they have with the one they want" },
  { url: "/placeholders/carousels/home/02-cream-sofa.png", alt: "Customer with two phones at home", caption: "Confirm the trade-in value before they walk in" },
];
const CAROUSELS = [CAROUSEL_STORE, CAROUSEL_HOME];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 1, prepare: false });
  const db = drizzle(sql);

  // All lesson rows that aren't already the new placeholder set or scratch QA.
  const rows = await db
    .select({
      id: lessons.id,
      internalName: lessons.internalName,
      contentType: lessons.contentType,
    })
    .from(lessons)
    .where(
      and(
        notLike(lessons.internalName, "placeholder-%"),
        notLike(lessons.internalName, "scratch-bulk-qa-%"),
      ),
    )
    .orderBy(lessons.internalName);

  const counts = { video: 0, image: 0, carousel: 0 };
  const cursors = { video: 0, image: 0, carousel: 0 };

  for (const r of rows) {
    const ct = r.contentType as "video" | "image" | "carousel";

    if (ct === "video") {
      const v = REELS[cursors.video++ % REELS.length];
      counts.video += 1;
      await db
        .update(lessonTranslations)
        .set({
          muxPlaybackId: v.muxPlaybackId,
          muxAssetId: v.muxAssetId,
          muxUploadId: null,
          durationSeconds: v.durationSeconds,
          aspectRatio: v.aspectRatio,
          thumbnailUrl: null,
          muxErrorMessage: null,
          // Wipe other-type fields in case this row was multi-typed in history.
          imageUrl: null,
          imageAlt: null,
          carouselSlides: null,
        })
        .where(
          and(
            eq(lessonTranslations.lessonId, r.id),
            eq(lessonTranslations.language, LANG),
          ),
        );
      console.log(`  video    ${r.internalName.padEnd(36)} ⟵ ${v.muxPlaybackId.slice(0, 10)}…`);
    } else if (ct === "image") {
      const s = STILLS[cursors.image++ % STILLS.length];
      counts.image += 1;
      await db
        .update(lessonTranslations)
        .set({
          imageUrl: s.url,
          imageAlt: s.alt,
          aspectRatio: 0.8,
          // Wipe other-type fields.
          muxPlaybackId: null,
          muxAssetId: null,
          muxUploadId: null,
          durationSeconds: null,
          thumbnailUrl: null,
          muxErrorMessage: null,
          carouselSlides: null,
        })
        .where(
          and(
            eq(lessonTranslations.lessonId, r.id),
            eq(lessonTranslations.language, LANG),
          ),
        );
      console.log(`  image    ${r.internalName.padEnd(36)} ⟵ ${s.url}`);
    } else if (ct === "carousel") {
      const c = CAROUSELS[cursors.carousel++ % CAROUSELS.length];
      counts.carousel += 1;
      await db
        .update(lessonTranslations)
        .set({
          carouselSlides: c,
          aspectRatio: 0.8,
          // Wipe other-type fields.
          muxPlaybackId: null,
          muxAssetId: null,
          muxUploadId: null,
          durationSeconds: null,
          thumbnailUrl: null,
          muxErrorMessage: null,
          imageUrl: null,
          imageAlt: null,
        })
        .where(
          and(
            eq(lessonTranslations.lessonId, r.id),
            eq(lessonTranslations.language, LANG),
          ),
        );
      console.log(
        `  carousel ${r.internalName.padEnd(36)} ⟵ ${c === CAROUSEL_STORE ? "store" : "home"} (${c.length} slides)`,
      );
    }
  }

  console.log(
    `\nDone. repointed ${counts.video} video / ${counts.image} image / ${counts.carousel} carousel lesson(s).`,
  );
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
