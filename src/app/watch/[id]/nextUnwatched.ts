// Pure helper used by the Reels feed after a celebration burst drains.
// Returns the index of the first item AFTER `activeIndex` (wrapping back to
// 0) whose id is NOT in `completed`. Excludes `activeIndex` itself — the
// caller has just landed there and scrolling to self is a no-op. Returns -1
// when no other item is unwatched.

export function nextUnwatchedIndex<T extends { id: string }>(
  items: T[],
  activeIndex: number,
  completed: ReadonlySet<string>,
): number {
  const n = items.length;
  if (n === 0) return -1;
  for (let step = 1; step < n; step++) {
    const i = (activeIndex + step) % n;
    if (!completed.has(items[i]!.id)) return i;
  }
  return -1;
}
