"use client";

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
  return (
    <div className="flex flex-col">
      <header className="mb-7 text-center">
        <h1 className="text-balance text-2xl font-medium leading-tight tracking-tight text-white sm:text-3xl">
          Select your store
        </h1>
        <p className="mt-2 text-sm text-white/65">
          Pick the location where you&apos;ll be working. We&apos;ll re-check this
          every 30 days.
        </p>
      </header>

      <ul className="max-h-[44vh] space-y-2 overflow-y-auto pr-1">
        {stores.length === 0 ? (
          <li className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/55">
            No stores configured for your team yet.
          </li>
        ) : (
          stores.map((s) => {
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
                    "group flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all duration-200 ease-out",
                    selected
                      ? "border-arctic-haze/60 bg-arctic-haze/10"
                      : "border-white/12 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.06]",
                  )}
                >
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-white">
                      {s.name}
                    </span>
                    {s.city && (
                      <span className="block text-xs text-white/55">{s.city}</span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full border transition-all duration-200",
                      selected
                        ? "border-arctic-haze bg-arctic-haze"
                        : "border-white/25 bg-transparent group-hover:border-white/40",
                    )}
                    aria-hidden
                  >
                    {selected && (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-3 w-3 text-near-black"
                      >
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                    )}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>

      <label className="mt-4 flex cursor-pointer items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/80 transition-colors hover:bg-white/[0.05]">
        <input
          type="checkbox"
          checked={hq}
          onChange={(e) => onHqChange(e.target.checked)}
          className="h-4 w-4 rounded border-white/20 bg-white/[0.04] text-arctic-haze accent-arctic-haze"
        />
        I&apos;m not assigned to a store (HQ / other)
      </label>

      {error && (
        <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mt-7 flex items-center gap-2.5">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04] text-white transition-colors hover:bg-white/[0.07] disabled:opacity-40"
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
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || (stores.length === 0 && !hq) || (!hq && !storeId)}
          className="inline-flex flex-1 items-center justify-center rounded-2xl bg-arctic-haze px-4 py-3.5 font-mono text-sm font-medium uppercase tracking-wider text-near-black transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "Saving…" : submitLabel}
        </button>
      </div>
    </div>
  );
}
