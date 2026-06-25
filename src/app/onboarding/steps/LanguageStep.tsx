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
}: {
  languages: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <ul className="flex flex-col gap-4">
      {languages.map((code, i) => {
        const meta = metaFor(code);
        const selected = value === code;
        // Figma fades the unselected options as they go down the list.
        const fadeOpacity = selected ? 1 : Math.max(0.5, 1 - i * 0.12);
        return (
          <li key={code}>
            <button
              type="button"
              onClick={() => onChange(code)}
              aria-pressed={selected}
              style={{ opacity: selected ? 1 : fadeOpacity }}
              className={cn(
                "flex h-[52px] w-full items-center gap-3 rounded-[24px] border bg-[rgba(68,81,88,0.1)] px-5 text-left backdrop-blur-md transition-all duration-200",
                selected
                  ? "border-[#c1e8fb]"
                  : "border-[#445158] hover:border-[#445158]/80",
              )}
            >
              <span className="text-xl leading-none" aria-hidden>
                {meta.flag}
              </span>
              <span className="text-[16px] leading-[1.3] text-[#8e8e8e]">
                {meta.label}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
