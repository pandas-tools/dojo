"use client";

import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";

type StoreRow = {
  id: string;
  name: string;
  city: string | null;
  // Optional until the stores schema grows an address column; the row
  // renders its secondary line from whatever subset is present.
  address?: string | null;
};

const HQ_LABEL = "I'm not assigned to a store";
const PLACEHOLDER = "Select your store";

/**
 * StoreStep — dropdown combobox. Collapsed trigger shows the current pick
 * (or a placeholder — no silent preselection, per the Figma direction);
 * the open panel holds a search field that filters on name, city, and
 * address, with the HQ escape hatch pinned first and exempt from the
 * filter. Store rows show name at full strength plus an address · city
 * line in a smaller size — same city can hold several stores, so the
 * address is what disambiguates.
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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

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

  const detailLine = (s: StoreRow) =>
    [s.address, s.city].filter(Boolean).join(" · ");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.city ?? "").toLowerCase().includes(q) ||
        (s.address ?? "").toLowerCase().includes(q),
    );
  }, [stores, query]);

  const selectedStore = stores.find((s) => s.id === storeId);
  const triggerLabel = hq
    ? HQ_LABEL
    : selectedStore
      ? display(selectedStore.name)
      : PLACEHOLDER;
  const hasSelection = hq || Boolean(selectedStore);

  function toggleOpen() {
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        setQuery("");
        // Focus after the panel mounts.
        setTimeout(() => searchRef.current?.focus(), 0);
      }
      return next;
    });
  }

  function pickStore(id: string) {
    onHqChange(false);
    onStoreChange(id);
    setOpen(false);
  }

  function pickHq() {
    onHqChange(true);
    onStoreChange("");
    setOpen(false);
  }

  return (
    <div
      className="relative flex w-full flex-col gap-3"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      {/* TRIGGER */}
      <button
        type="button"
        onClick={toggleOpen}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex h-[52px] w-full items-center justify-between gap-3 rounded-[24px] border bg-[rgba(68,81,88,0.1)] px-5 text-left backdrop-blur-md transition-colors duration-200",
          open || hasSelection ? "border-[#c1e8fb]" : "border-[#445158]",
        )}
      >
        <span
          className={cn(
            "block truncate text-[16px] leading-[1.3]",
            hasSelection ? "text-[#fefefe]" : "text-[#8e8e8e]",
          )}
        >
          {triggerLabel}
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={cn(
            "h-4 w-4 shrink-0 text-[#c1e8fb] transition-transform duration-200",
            open && "rotate-180",
          )}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* PANEL */}
      {open && (
        <>
          {/* Tap-outside layer */}
          <div
            className="fixed inset-0 z-10"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            role="listbox"
            aria-label="Stores"
            // Panel top sits at ~50dvh + 34px (centered trigger + gap); the
            // CTA row starts at 86dvh. Cap height to the space between them
            // so the open panel never covers the Continue button.
            className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 flex max-h-[min(340px,calc(36dvh-48px))] flex-col gap-2 overflow-hidden rounded-[24px] border border-[#445158] bg-near-black/90 p-2 backdrop-blur-xl"
          >
            <label htmlFor="store-search" className="sr-only">
              Search stores
            </label>
            <input
              ref={searchRef}
              id="store-search"
              type="search"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by store, city, address…"
              className="block h-[44px] w-full shrink-0 rounded-[18px] border border-[#445158] bg-[rgba(68,81,88,0.15)] px-4 text-[15px] leading-[22px] text-[#fefefe] placeholder:text-[#8e8e8e] focus:border-[#c1e8fb] focus:outline-none"
            />

            <ul className="dojo-store-list flex w-full flex-col gap-1 overflow-y-auto">
              <li className="w-full">
                <OptionRow
                  label={HQ_LABEL}
                  selected={hq}
                  onClick={pickHq}
                />
              </li>
              {stores.length === 0 && (
                <li className="px-4 py-3 text-center text-sm text-[#fefefe]">
                  No stores configured yet.
                </li>
              )}
              {stores.length > 0 && filtered.length === 0 && (
                <li className="px-4 py-3 text-center text-sm text-[#fefefe]">
                  No stores match &ldquo;{query.trim()}&rdquo;.
                </li>
              )}
              {filtered.map((s) => (
                <li key={s.id} className="w-full">
                  <OptionRow
                    label={display(s.name)}
                    detail={detailLine(s)}
                    selected={!hq && s.id === storeId}
                    onClick={() => pickStore(s.id)}
                  />
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {error && (
        <p className="mt-1 rounded-[16px] border border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function OptionRow({
  label,
  detail,
  onClick,
  selected = false,
}: {
  label: string;
  detail?: string;
  onClick: () => void;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        "block w-full rounded-[16px] border px-4 py-[10px] text-left transition-colors duration-200",
        selected
          ? "border-[#c1e8fb] bg-[rgba(193,232,251,0.08)]"
          : "border-transparent hover:bg-[rgba(68,81,88,0.25)]",
      )}
    >
      <span className="block truncate text-[15px] leading-[1.3] text-[#fefefe]">
        {label}
      </span>
      {detail && (
        <span className="mt-[2px] block truncate text-[13px] leading-[1.3] text-[#c1e8fb]/70">
          {detail}
        </span>
      )}
    </button>
  );
}
