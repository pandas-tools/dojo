"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";

type StoreRow = { id: string; name: string; city: string | null };

const HQ_LABEL = "I'm not assigned to a store (HQ / other)";

/**
 * StoreStep — matches Figma 96:103. Layout:
 *   1. Dropdown trigger row at top — shows the currently picked store
 *      (or 'HQ / …' if HQ, or empty + chevron when nothing picked).
 *   2. List of stores below + an HQ row at the bottom so users without
 *      a store still have a single, unified picker.
 *
 * Selected item is hidden from the list (it's already in the trigger),
 * so there's no duplicate row.
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
  // so 'Orange Antwerp Central' / 'Orange Brussels Midi' render as
  // 'Antwerp Central' / 'Brussels Midi'. Auto-detects per client.
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
    const lastSpace = prefix.lastIndexOf(" ");
    return lastSpace > 0 ? prefix.slice(0, lastSpace + 1) : "";
  }, [stores]);

  const display = (name: string) =>
    commonPrefix && name.startsWith(commonPrefix)
      ? name.slice(commonPrefix.length)
      : name;

  const triggerText = hq
    ? HQ_LABEL
    : selectedStore
      ? display(selectedStore.name)
      : "";

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Dropdown trigger — chevron absolutely positioned so the text
          centers on the full trigger width regardless of label length. */}
      <div className="relative h-[52px] w-full rounded-[24px] border border-[#c1e8fb] bg-[rgba(68,81,88,0.1)] backdrop-blur-md">
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center px-12 text-center text-[16px] leading-[24px] tracking-[0.08px]",
            hq || selectedStore ? "text-[#fefefe]" : "text-[#8e8e8e]",
          )}
        >
          <span className="truncate">{triggerText}</span>
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

      {/* Options list — stores + an HQ row at the end. Picked option is
          hidden so it only appears in the trigger above. ~3 visible rows;
          scrolls on touch/wheel. Scrollbar hidden — a visible rounded pill
          thumb read as a stray dark line on the right edge of the mobile
          login. Bottom fade signals "more below" instead. */}
      <ul
        className="flex w-full flex-col gap-2 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{
          maxHeight: "240px",
          WebkitMaskImage:
            "linear-gradient(180deg, #000 0, #000 calc(100% - 24px), transparent 100%)",
          maskImage:
            "linear-gradient(180deg, #000 0, #000 calc(100% - 24px), transparent 100%)",
        }}
      >
        {stores.length === 0 && !hq && (
          <li className="rounded-[24px] border border-[#445158] bg-[rgba(68,81,88,0.1)] px-5 py-3 text-center text-sm text-[#8e8e8e]">
            No stores configured yet.
          </li>
        )}
        {stores
          .filter((s) => hq || s.id !== storeId)
          .map((s) => (
            <li key={s.id} className="w-full">
              <OptionPill
                label={display(s.name)}
                onClick={() => {
                  onHqChange(false);
                  onStoreChange(s.id);
                }}
              />
            </li>
          ))}
        {/* HQ option — sits at the bottom of the list. Hidden when already
            picked (it's in the trigger). */}
        {!hq && (
          <li className="w-full">
            <OptionPill
              label={HQ_LABEL}
              onClick={() => {
                onHqChange(true);
                onStoreChange("");
              }}
              variant="muted"
            />
          </li>
        )}
      </ul>

      {error && (
        <p className="mt-1 rounded-[16px] border border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function OptionPill({
  label,
  onClick,
  variant = "default",
}: {
  label: string;
  onClick: () => void;
  variant?: "default" | "muted";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "block h-[52px] w-full rounded-[24px] border border-[#445158] bg-[rgba(68,81,88,0.1)] px-5 text-center text-[16px] leading-[1.3] backdrop-blur-md transition-colors duration-200",
        variant === "muted"
          ? "text-[#8e8e8e]/85 hover:text-[#fefefe]"
          : "text-[#8e8e8e] hover:text-[#fefefe]",
      )}
    >
      <span className="block truncate">{label}</span>
    </button>
  );
}
