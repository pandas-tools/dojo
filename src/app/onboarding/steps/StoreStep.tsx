"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";

type StoreRow = { id: string; name: string; city: string | null };

const HQ_LABEL = "I'm not assigned to a store (HQ / other)";

/**
 * StoreStep — search field + flat scrollable list. The HQ pill is pinned
 * first (always visible, exempt from the search filter) since it's the
 * escape hatch for non-store employees. Store rows show name + city;
 * selection is signalled by the arctic-haze border, all rows stay at full
 * legibility. Scrollbar is intentionally visible to signal more rows below.
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
  const [query, setQuery] = useState("");

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.city ?? "").toLowerCase().includes(q),
    );
  }, [stores, query]);

  return (
    <div className="flex w-full flex-col gap-3">
      <label htmlFor="store-search" className="sr-only">
        Search stores
      </label>
      <input
        id="store-search"
        type="search"
        autoComplete="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by store or city…"
        className="block h-[52px] w-full shrink-0 rounded-[24px] border border-[#445158] bg-[rgba(68,81,88,0.1)] px-5 text-[16px] leading-[24px] text-[#fefefe] backdrop-blur-md placeholder:text-[#8e8e8e] focus:border-[#c1e8fb] focus:outline-none focus:ring-2 focus:ring-arctic-haze/40"
      />

      <ul
        className="dojo-store-list flex w-full flex-col gap-2 overflow-y-auto"
        style={{ maxHeight: "296px" }}
      >
        <li className="w-full">
          <OptionPill
            label={HQ_LABEL}
            selected={hq}
            onClick={() => {
              onHqChange(true);
              onStoreChange("");
            }}
          />
        </li>
        {stores.length === 0 && (
          <li className="rounded-[24px] border border-[#445158] bg-[rgba(68,81,88,0.1)] px-5 py-3 text-center text-sm text-[#fefefe]">
            No stores configured yet.
          </li>
        )}
        {stores.length > 0 && filtered.length === 0 && (
          <li className="rounded-[24px] border border-[#445158] bg-[rgba(68,81,88,0.1)] px-5 py-3 text-center text-sm text-[#fefefe]">
            No stores match &ldquo;{query.trim()}&rdquo;.
          </li>
        )}
        {filtered.map((s) => (
          <li key={s.id} className="w-full">
            <OptionPill
              label={display(s.name)}
              city={s.city}
              selected={!hq && s.id === storeId}
              onClick={() => {
                onHqChange(false);
                onStoreChange(s.id);
              }}
            />
          </li>
        ))}
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
  city,
  onClick,
  selected = false,
}: {
  label: string;
  city?: string | null;
  onClick: () => void;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "block w-full rounded-[24px] border bg-[rgba(68,81,88,0.1)] px-5 text-left backdrop-blur-md transition-colors duration-200",
        city ? "py-[10px]" : "flex h-[52px] items-center",
        selected ? "border-[#c1e8fb]" : "border-[#445158] hover:border-[#445158]/70",
      )}
    >
      <span className="block truncate text-[16px] leading-[1.3] text-[#fefefe]">
        {label}
      </span>
      {city && (
        <span className="mt-[2px] block truncate text-[13px] leading-[1.3] text-[#c1e8fb]/70">
          {city}
        </span>
      )}
    </button>
  );
}
