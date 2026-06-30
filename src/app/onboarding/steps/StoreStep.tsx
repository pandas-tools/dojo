"use client";

import { cn } from "@/lib/cn";

type StoreRow = { id: string; name: string; city: string | null };

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
  return (
    <div className="flex flex-col gap-2">
      {/* Store list — Figma shows ~6 items fading out as they go down.
          (The Figma had a separate 'dropdown trigger' at the top, but
          showing both the trigger AND the always-expanded list duplicates
          the selected row visually — list-only is cleaner.) */}
      <ul className="flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1">
        {stores.length === 0 ? (
          <li className="rounded-[24px] border border-[#445158] bg-[rgba(68,81,88,0.1)] px-4 py-3 text-center text-sm text-[#8e8e8e]">
            No stores configured yet.
          </li>
        ) : (
          stores.map((s, i) => {
            const selected = !hq && storeId === s.id;
            const fadeOpacity = selected ? 1 : Math.max(0.35, 1 - i * 0.12);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    onHqChange(false);
                    onStoreChange(s.id);
                  }}
                  aria-pressed={selected}
                  style={{ opacity: selected ? 1 : fadeOpacity }}
                  className={cn(
                    "flex h-[52px] w-full items-center justify-between rounded-[24px] border bg-[rgba(68,81,88,0.1)] px-4 text-left backdrop-blur-md transition-all duration-200",
                    selected ? "border-[#c1e8fb]" : "border-[#445158]",
                  )}
                >
                  <span className="text-[16px] leading-[1.3] text-[#8e8e8e]">
                    {s.name}
                  </span>
                  {s.city && (
                    <span className="text-[13px] text-[#8e8e8e]/70">
                      {s.city}
                    </span>
                  )}
                </button>
              </li>
            );
          })
        )}
      </ul>

      {/* HQ checkbox */}
      <label
        className={cn(
          "mt-2 flex h-[52px] cursor-pointer items-center gap-3 rounded-[24px] border bg-[rgba(68,81,88,0.1)] px-4 text-[14px] text-[#8e8e8e] backdrop-blur-md transition-all duration-200",
          hq ? "border-[#c1e8fb]" : "border-[#445158]",
        )}
      >
        <input
          type="checkbox"
          checked={hq}
          onChange={(e) => onHqChange(e.target.checked)}
          className="h-4 w-4 rounded border-white/20 bg-white/[0.04] text-arctic-haze accent-arctic-haze"
        />
        <span className="text-[#fefefe]">
          I&apos;m not assigned to a store (HQ / other)
        </span>
      </label>

      {error && (
        <p className="mt-2 rounded-[16px] border border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
