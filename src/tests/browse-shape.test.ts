// Unit test for the pure /browse shaper — grouping, section ordering,
// within-group ordering, empty-group dropping, the ungrouped bucket, and the
// completed/bookmarked/ready projection. No database: everything the shaper
// needs is passed in.

import { describe, expect, it } from "vitest";
import { shapeBrowseData, UNGROUPED_LABEL } from "@/lib/browse-shape";
import type { Lesson, LessonTranslation } from "@/lib/db/schema";

function lesson(over: Partial<Lesson> & { id: string }): Lesson {
  return {
    internalName: over.id,
    type: "training",
    contentType: "video",
    sortOrder: 0,
    groupId: null,
    groupSortOrder: 0,
    isPublished: true,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...over,
  } as Lesson;
}

function tr(over: Partial<LessonTranslation> & { lessonId: string }): LessonTranslation {
  return {
    id: `t-${over.lessonId}`,
    language: "en",
    title: `Title ${over.lessonId}`,
    description: null,
    notesMarkdown: null,
    muxPlaybackId: null,
    muxAssetId: null,
    muxUploadId: null,
    durationSeconds: null,
    thumbnailUrl: null,
    muxErrorMessage: null,
    imageUrl: null,
    imageAlt: null,
    carouselSlides: null,
    aspectRatio: null,
    ...over,
  } as LessonTranslation;
}

describe("shapeBrowseData", () => {
  it("orders sections by group sortOrder and lessons by group_sort_order", () => {
    const groups = [
      { id: "g2", name: "Customer flows", sortOrder: 1 },
      { id: "g1", name: "Managing the store", sortOrder: 0 },
    ];
    // groupSortOrder drives within-group order; sortOrder is set inversely to
    // prove the global column is NOT used for grouped lessons.
    const lessons = [
      lesson({ id: "a", groupId: "g1", groupSortOrder: 2, sortOrder: 1 }),
      lesson({ id: "b", groupId: "g1", groupSortOrder: 1, sortOrder: 2 }),
      lesson({ id: "c", groupId: "g2", groupSortOrder: 0 }),
    ];
    const out = shapeBrowseData({
      lessons,
      groups,
      translationsByLesson: new Map(),
      completedIds: new Set(),
      bookmarkedIds: new Set(),
    });
    expect(out.map((g) => g.id)).toEqual(["g1", "g2"]);
    expect(out[0].cards.map((c) => c.id)).toEqual(["b", "a"]);
    expect(out[1].cards.map((c) => c.id)).toEqual(["c"]);
  });

  it("orders the ungrouped bucket by global sortOrder", () => {
    // sortOrder drives the ungrouped bucket; groupSortOrder is inverse and ignored.
    const lessons = [
      lesson({ id: "x", groupId: null, sortOrder: 5, groupSortOrder: 0 }),
      lesson({ id: "y", groupId: null, sortOrder: 1, groupSortOrder: 9 }),
    ];
    const out = shapeBrowseData({
      lessons,
      groups: [],
      translationsByLesson: new Map(),
      completedIds: new Set(),
      bookmarkedIds: new Set(),
    });
    expect(out[0].cards.map((c) => c.id)).toEqual(["y", "x"]);
  });

  it("drops sections that have no visible lessons for the client", () => {
    const groups = [
      { id: "g1", name: "Has lessons", sortOrder: 0 },
      { id: "g2", name: "Empty", sortOrder: 1 },
    ];
    const lessons = [lesson({ id: "a", groupId: "g1" })];
    const out = shapeBrowseData({
      lessons,
      groups,
      translationsByLesson: new Map(),
      completedIds: new Set(),
      bookmarkedIds: new Set(),
    });
    expect(out.map((g) => g.id)).toEqual(["g1"]);
  });

  it("puts ungrouped lessons (and unknown groupIds) in a trailing bucket", () => {
    const groups = [{ id: "g1", name: "Section", sortOrder: 0 }];
    const lessons = [
      lesson({ id: "a", groupId: "g1" }),
      lesson({ id: "b", groupId: null }),
      lesson({ id: "c", groupId: "deleted-group" }),
    ];
    const out = shapeBrowseData({
      lessons,
      groups,
      translationsByLesson: new Map(),
      completedIds: new Set(),
      bookmarkedIds: new Set(),
    });
    expect(out).toHaveLength(2);
    const bucket = out[out.length - 1];
    expect(bucket.id).toBeNull();
    expect(bucket.name).toBe(UNGROUPED_LABEL);
    expect(bucket.cards.map((c) => c.id).sort()).toEqual(["b", "c"]);
  });

  it("projects completed + bookmarked flags onto cards", () => {
    const out = shapeBrowseData({
      lessons: [lesson({ id: "a" }), lesson({ id: "b" })],
      groups: [],
      translationsByLesson: new Map(),
      completedIds: new Set(["a"]),
      bookmarkedIds: new Set(["b"]),
    });
    const cards = Object.fromEntries(
      out[0].cards.map((c) => [c.id, c]),
    );
    expect(cards.a.completed).toBe(true);
    expect(cards.a.isBookmarked).toBe(false);
    expect(cards.b.completed).toBe(false);
    expect(cards.b.isBookmarked).toBe(true);
  });

  it("resolves title/thumbnail/ready per content type from the translation", () => {
    const lessons = [
      lesson({ id: "vid", contentType: "video" }),
      lesson({ id: "img", contentType: "image" }),
      lesson({ id: "car", contentType: "carousel" }),
    ];
    const translationsByLesson = new Map<string, LessonTranslation>([
      [
        "vid",
        tr({
          lessonId: "vid",
          title: "Video lesson",
          muxPlaybackId: "pb_123",
          thumbnailUrl: "https://x/thumb.jpg",
          durationSeconds: 90,
        }),
      ],
      ["img", tr({ lessonId: "img", imageUrl: "https://x/i.png" })],
      [
        "car",
        tr({
          lessonId: "car",
          carouselSlides: [
            { url: "https://x/1.png", alt: "1" },
            { url: "https://x/2.png", alt: "2" },
          ],
        }),
      ],
    ]);
    const out = shapeBrowseData({
      lessons,
      groups: [],
      translationsByLesson,
      completedIds: new Set(),
      bookmarkedIds: new Set(),
    });
    const cards = Object.fromEntries(out[0].cards.map((c) => [c.id, c]));
    expect(cards.vid).toMatchObject({
      title: "Video lesson",
      thumbnail: "https://x/thumb.jpg",
      ready: true,
      durationSeconds: 90,
    });
    expect(cards.img).toMatchObject({
      thumbnail: "https://x/i.png",
      ready: true,
    });
    expect(cards.car).toMatchObject({
      thumbnail: "https://x/1.png",
      ready: true,
    });
  });

  it("marks a card not ready when its media is incomplete; falls back to internalName", () => {
    const out = shapeBrowseData({
      lessons: [lesson({ id: "x", internalName: "Internal X", contentType: "video" })],
      groups: [],
      translationsByLesson: new Map(),
      completedIds: new Set(),
      bookmarkedIds: new Set(),
    });
    expect(out[0].cards[0]).toMatchObject({
      title: "Internal X",
      ready: false,
      thumbnail: null,
    });
  });
});
