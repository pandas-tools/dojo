// Unit tests for the pure `nextUnwatchedIndex` helper — walks a feed array
// starting at activeIndex + 1, wraps to 0, returns the first item not in the
// completed set. Returns -1 when everything is completed.

import { describe, expect, it } from "vitest";
import { nextUnwatchedIndex } from "@/app/watch/[id]/nextUnwatched";

const items = [
  { id: "a" },
  { id: "b" },
  { id: "c" },
  { id: "d" },
];

describe("nextUnwatchedIndex", () => {
  it("returns the very next index when it's unwatched", () => {
    expect(nextUnwatchedIndex(items, 0, new Set(["a"]))).toBe(1);
  });

  it("skips completed items after activeIndex", () => {
    expect(nextUnwatchedIndex(items, 0, new Set(["a", "b", "c"]))).toBe(3);
  });

  it("wraps to index 0 when the tail is completed", () => {
    expect(nextUnwatchedIndex(items, 2, new Set(["c", "d"]))).toBe(0);
  });

  it("wraps past activeIndex to reach the only unwatched item", () => {
    expect(nextUnwatchedIndex(items, 2, new Set(["c", "d", "a"]))).toBe(1);
  });

  it("returns -1 when every item is completed", () => {
    expect(
      nextUnwatchedIndex(items, 0, new Set(["a", "b", "c", "d"])),
    ).toBe(-1);
  });

  it("returns -1 when the active is the only uncompleted item", () => {
    expect(nextUnwatchedIndex(items, 1, new Set(["a", "c", "d"]))).toBe(-1);
  });

  it("returns -1 on an empty feed", () => {
    expect(nextUnwatchedIndex([], 0, new Set())).toBe(-1);
  });

  it("handles activeIndex at the last position with an unwatched item at 0", () => {
    expect(nextUnwatchedIndex(items, 3, new Set(["b", "c", "d"]))).toBe(0);
  });
});
