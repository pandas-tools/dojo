"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";

type StoreRow = { id: string; name: string; city: string | null };

const HQ_LABEL = "I'm not assigned to a store (HQ / other)";

/**
 * StoreStep — flat scrollable list. The selected pill is highlighted
 * in-place (arctic-haze border + bright text) rather than promoted to a
 * separate trigger row; clicking any store just switches the highlight,
 * no reordering. HQ sits at the bottom as another selectable pill.
 * Scrollbar is intentionally visible to signal there are more rows below.
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

  return (
    <div className="flex w-full flex-col gap-3">
      <ul
        className="dojo-store-list flex w-full flex-col gap-2 overflow-y-auto pr-2"
        style={{ maxHeight: "336px" }}
      >
        {stores.length === 0 && !hq && (
          <li className="rounded-[24px] border border-[#445158] bg-[rgba(68,81,88,0.1)] px-5 py-3 text-center text-sm text-[#8e8e8e]">
            No stores configured yet.
          </li>
        )}
        {stores.map((s) => (
          <li key={s.id} className="w-full">
            <OptionPill
              label={display(s.name)}
              selected={!hq && s.id === storeId}
              onClick={() => {
                onHqChange(false);
                onStoreChange(s.id);
              }}
            />
          </li>
        ))}
        <li className="w-full">
          <OptionPill
            label={HQ_LABEL}
            selected={hq}
            onClick={() => {
              onHqChange(true);
              onStoreChange("");
            }}
            variant="muted"
          />
        </li>
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
  selected = false,
  variant = "default",
}: {
  label: string;
  onClick: () => void;
  selected?: boolean;
  variant?: "default" | "muted";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "block h-[52px] w-full rounded-[24px] border bg-[rgba(68,81,88,0.1)] px-5 text-center text-[16px] leading-[1.3] backdrop-blur-md transition-colors duration-200",
        selected
          ? "border-[#c1e8fb] text-[#fefefe]"
          : cn(
              "border-[#445158] hover:text-[#fefefe]",
              variant === "muted" ? "text-[#8e8e8e]/85" : "text-[#8e8e8e]",
            ),
      )}
    >
      <span className="block truncate">{label}</span>
    </button>
  );
}
