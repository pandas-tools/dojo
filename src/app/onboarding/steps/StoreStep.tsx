"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";

type StoreRow = { id: string; name: string; city: string | null };

/**
 * StoreStep — matches Figma 96:103. Layout:
 *   1. Dropdown trigger row at top — shows the currently picked store (or
 *      empty placeholder + chevron). Visual summary; tap doesn't toggle
 *      anything since the list below is always visible.
 *   2. List of stores. Capped to ~3 visible rows (height 192px) — the rest
 *      scroll behind a soft bottom fade so 'there's more' is implicit.
 *   3. HQ checkbox below the list (functional necessity for HQ users —
 *      Figma omits this but real users without a store need a way out).
 *
 * Selected highlight on the chosen row in the list (arctic-haze border)
 * is the only place the selection state is visible inside the list — the
 * trigger above gives the same info but as a label.
 */
export default function StoreStep({
  stores,
  storeId,
  hq,
  onStoreChange,
  onHqChange,
  error,
}: {
  stores: StoreRow[];
  storeId: string;
  hq: boolean;
  onStoreChange: (v: string) => void;
  onHqChange: (v: boolean) => void;
  error: string | null;
}) {
  const selectedStore = useMemo(
    () => stores.find((s) => s.id === storeId) ?? null,
    [stores, storeId],
  );

  // Strip the longest common WORD-aligned prefix across all store names
  // so dojo's 'Orange Antwerp Central' / 'Orange Brussels Midi' render as
  // 'Antwerp Central' / 'Brussels Midi'. Auto-adapts to any client — the
  // prefix could be 'Orange' or 'Apple Store' or 'Orange Store' depending
  // on the operator. Falls back to the full name when no common prefix
  // exists (e.g. mixed-brand store list).
  const commonPrefix = useMemo(() => {
    if (stores.length < 2) return "";
    let prefix = stores[0]!.name;
    for (const s of stores.slice(1)) {
      let i = 0;
      while (i < prefix.length && i < s.name.length && prefix[i] === s.name[i]) {
        i++;
      }
      prefix = prefix.slice(0, i);
      if (!prefix) break;
    }
    // Trim to the last whole-word boundary so we don't chop mid-word
    const lastSpace = prefix.lastIndexOf(" ");
    return lastSpace > 0 ? prefix.slice(0, lastSpace + 1) : "";
  }, [stores]);

  const display = (name: string) =>
    commonPrefix && name.startsWith(commonPrefix)
      ? name.slice(commonPrefix.length)
      : name;

  return (
    <div className="flex flex-col gap-3">
      {/* Selected display — the Figma 'dropdown trigger' (visual only;
          list below is always expanded). Chevron is absolute-positioned so
          the trigger text stays truly centered. */}
      <div className="relative flex h-[52px] items-center justify-center rounded-[24px] border border-[#c1e8fb] bg-[rgba(68,81,88,0.1)] px-12 backdrop-blur-md">
        <span
          className={cn(
            "truncate text-center text-[16px] leading-[24px] tracking-[0.08px]",
            hq || selectedStore ? "text-[#fefefe]" : "text-[#8e8e8e]",
          )}
        >
          {hq
            ? "HQ / Not assigned to a store"
            : selectedStore
              ? display(selectedStore.name)
              : ""}
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute right-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8e8e8e]"
          aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Store list — height-capped to 3 rows; remainder scrolls (no fade).
          Hides the currently-picked store so it's only visible in the
          trigger above — no duplicate row. */}
      <div className="relative">
        <ul
          className="flex flex-col gap-2 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          style={{ maxHeight: "180px" }}
        >
          {stores.length === 0 ? (
            <li className="rounded-[24px] border border-[#445158] bg-[rgba(68,81,88,0.1)] px-5 py-3 text-center text-sm text-[#8e8e8e]">
              No stores configured yet.
            </li>
          ) : (
            stores
              .filter((s) => hq || s.id !== storeId)
              .map((s) => {
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onHqChange(false);
                        onStoreChange(s.id);
                      }}
                      className={cn(
                        "flex h-[52px] w-full items-center justify-center rounded-[24px] border border-[#445158] bg-[rgba(68,81,88,0.1)] px-5 text-center text-[#8e8e8e] backdrop-blur-md transition-all duration-200 hover:text-[#fefefe]",
                      )}
                    >
                      <span className="truncate text-[16px] leading-[1.3]">
                        {display(s.name)}
                      </span>
                    </button>
                  </li>
                );
              })
          )}
        </ul>
      </div>

      {/* HQ checkbox — Figma doesn't show this but real HQ users need it.
          Kept compact + below the list. */}
      <label
        className={cn(
          "mt-1 flex h-[44px] cursor-pointer items-center justify-center gap-2.5 rounded-[22px] border bg-[rgba(68,81,88,0.1)] px-4 text-[13px] text-[#8e8e8e] backdrop-blur-md transition-all duration-200",
          hq ? "border-[#c1e8fb] text-[#fefefe]" : "border-[#445158]",
        )}
      >
        <input
          type="checkbox"
          checked={hq}
          onChange={(e) => onHqChange(e.target.checked)}
          className="h-4 w-4 rounded border-white/20 bg-white/[0.04] text-arctic-haze accent-arctic-haze"
        />
        <span>I&apos;m not assigned to a store (HQ / other)</span>
      </label>

      {error && (
        <p className="mt-1 rounded-[16px] border border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
