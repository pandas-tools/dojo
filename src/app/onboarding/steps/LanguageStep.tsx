"use client";

import { cn } from "@/lib/cn";

const LANGUAGE_META: Record<string, { label: string; native: string; flag: string }> = {
  en: { label: "English",    native: "English",    flag: "🇬🇧" },
  fr: { label: "French",     native: "Français",   flag: "🇫🇷" },
  nl: { label: "Dutch",      native: "Nederlands", flag: "🇳🇱" },
  de: { label: "German",     native: "Deutsch",    flag: "🇩🇪" },
  es: { label: "Spanish",    native: "Español",    flag: "🇪🇸" },
  it: { label: "Italian",    native: "Italiano",   flag: "🇮🇹" },
  pt: { label: "Portuguese", native: "Português",  flag: "🇵🇹" },
};

function metaFor(code: string) {
  return (
    LANGUAGE_META[code] ?? {
      label: code.toUpperCase(),
      native: code.toUpperCase(),
      flag: "🌐",
    }
  );
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
    <div className="flex flex-col">
      <header className="mb-7 text-center">
        <h1 className="text-balance text-2xl font-medium leading-tight tracking-tight text-white sm:text-3xl">
          Select your language
        </h1>
        <p className="mt-2 text-sm text-white/65">
          We&apos;ll translate your training to this language when available.
        </p>
      </header>

      <ul className="space-y-2.5">
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
                  "group relative flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all duration-200 ease-out",
                  selected
                    ? "border-arctic-haze/60 bg-arctic-haze/10 shadow-[0_0_0_4px_rgba(193,232,251,0.08)]"
                    : "border-white/12 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.06]",
                )}
              >
                <span className="text-xl leading-none" aria-hidden>{meta.flag}</span>
                <span className="flex-1">
                  <span className="block text-sm font-medium text-white">
                    {meta.native}
                  </span>
                  {meta.native !== meta.label && (
                    <span className="block text-xs text-white/55">{meta.label}</span>
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
        })}
      </ul>

      <button
        type="button"
        onClick={onNext}
        disabled={!value}
        className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-arctic-haze px-4 py-3.5 font-mono text-sm font-medium uppercase tracking-wider text-near-black transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Continue
      </button>
    </div>
  );
}
