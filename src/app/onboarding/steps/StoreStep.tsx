"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";

type StoreRow = {
  id: string;
  name: string;
  city: string | null;
};

export default function StoreStep({
  stores,
  storeId,
  hq,
  onStoreChange,
  onHqChange,
  onBack,
  onSubmit,
  submitting,
  error,
  submitLabel,
}: {
  stores: StoreRow[];
  storeId: string;
  hq: boolean;
  onStoreChange: (v: string) => void;
  onHqChange: (v: boolean) => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
  submitLabel: string;
}) {
  const [query, setQuery] = useState("");

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
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <header className="mt-10 text-center">
        <h1 className="text-balance text-[28px] font-medium leading-tight tracking-tight text-white sm:text-[32px]">
          Select your Store
        </h1>
      </header>

      <div className="relative mt-10">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search store"
          aria-label="Search store"
          className="w-full rounded-full border border-white/15 bg-white/[0.03] px-5 py-3.5 pr-12 text-sm text-white placeholder:text-white/35 transition-all duration-200 focus:border-arctic-haze/60 focus:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-arctic-haze/30"
        />
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute right-5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45"
          aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      <ul className="mt-3 flex-1 space-y-2.5 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <li className="rounded-full border border-white/10 bg-white/[0.02] px-5 py-3.5 text-center text-sm text-white/55">
            No stores match.
          </li>
        ) : (
          filtered.map((s) => {
            const selected = !hq && storeId === s.id;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    onHqChange(false);
                    onStoreChange(s.id);
                  }}
                  aria-pressed={selected}
                  className={cn(
                    "flex w-full items-center justify-between rounded-full border px-5 py-3 text-left transition-all duration-200 ease-out",
                    selected
                      ? "border-arctic-haze/60 bg-arctic-haze/[0.08] shadow-[0_0_0_4px_rgba(193,232,251,0.06)]"
                      : "border-white/15 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.04]",
                  )}
                >
                  <span className="text-sm font-medium text-white">
                    {s.name}
                  </span>
                  {s.city && (
                    <span className="text-xs text-white/45">{s.city}</span>
                  )}
                </button>
              </li>
            );
          })
        )}
      </ul>

      <label className="mt-3 flex cursor-pointer items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.02] px-5 py-3 text-sm text-white/80 transition-colors hover:bg-white/[0.04]">
        <input
          type="checkbox"
          checked={hq}
          onChange={(e) => onHqChange(e.target.checked)}
          className="h-4 w-4 rounded border-white/20 bg-white/[0.04] text-arctic-haze accent-arctic-haze"
        />
        I&apos;m not assigned to a store (HQ / other)
      </label>

      {error && (
        <p className="mt-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mt-8 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="inline-flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.02] text-white transition-all duration-200 hover:border-white/25 hover:bg-white/[0.05] disabled:opacity-50"
          aria-label="Back to language"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || (stores.length === 0 && !hq) || (!hq && !storeId)}
          className="inline-flex flex-1 items-center justify-center rounded-full bg-near-black px-4 py-4 text-sm font-medium text-white shadow-[0_18px_50px_-12px_rgba(0,0,0,0.65)] ring-1 ring-white/10 transition-all duration-200 hover:bg-near-black/85 hover:ring-white/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Saving…" : submitLabel}
        </button>
      </div>
    </div>
  );
}
