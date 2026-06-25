"use client";

import { cn } from "@/lib/cn";

const LANGUAGE_META: Record<string, { label: string; flag: string }> = {
  en: { label: "English",    flag: "🇬🇧" },
  fr: { label: "French",     flag: "🇫🇷" },
  nl: { label: "Dutch",      flag: "🇳🇱" },
  de: { label: "German",     flag: "🇩🇪" },
  es: { label: "Spanish",    flag: "🇪🇸" },
  it: { label: "Italian",    flag: "🇮🇹" },
  pt: { label: "Portuguese", flag: "🇵🇹" },
};

function metaFor(code: string) {
  return LANGUAGE_META[code] ?? { label: code.toUpperCase(), flag: "🌐" };
}

export default function LanguageStep({
  languages,
  value,
  onChange,
  onNext,
}: {
  languages: string[];
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <header className="mt-10 text-center">
        <h1 className="text-balance text-[28px] font-medium leading-tight tracking-tight text-white sm:text-[32px]">
          Select your Language
        </h1>
      </header>

      <ul className="mt-10 space-y-3">
        {languages.map((code) => {
          const meta = metaFor(code);
          const selected = value === code;
          return (
            <li key={code}>
              <button
                type="button"
                onClick={() => onChange(code)}
                aria-pressed={selected}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-full border px-5 py-3.5 text-left transition-all duration-200 ease-out",
                  selected
                    ? "border-arctic-haze/60 bg-arctic-haze/[0.08] shadow-[0_0_0_4px_rgba(193,232,251,0.06)]"
                    : "border-white/15 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.04]",
                )}
              >
                <span className="text-lg leading-none" aria-hidden>
                  {meta.flag}
                </span>
                <span className="text-sm font-medium text-white">
                  {meta.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto pt-8">
        <button
          type="button"
          onClick={onNext}
          disabled={!value}
          className="inline-flex w-full items-center justify-center rounded-full bg-near-black px-4 py-4 text-sm font-medium text-white shadow-[0_18px_50px_-12px_rgba(0,0,0,0.65)] ring-1 ring-white/10 transition-all duration-200 hover:bg-near-black/85 hover:ring-white/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
