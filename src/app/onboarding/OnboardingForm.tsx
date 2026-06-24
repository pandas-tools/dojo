"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeOnboarding } from "./actions";

type StoreRow = {
  id: string;
  name: string;
  city: string | null;
};

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  fr: "Français",
  nl: "Nederlands",
  de: "Deutsch",
  es: "Español",
  it: "Italiano",
  pt: "Português",
};

function labelFor(code: string) {
  return LANGUAGE_LABELS[code] ?? code.toUpperCase();
}

type Props = {
  stores: StoreRow[];
  languages: string[];
  initialLanguage: string;
  initialStoreId: string | null;
  mode: "first" | "reconfirm";
};

export default function OnboardingForm({
  stores,
  languages,
  initialLanguage,
  initialStoreId,
  mode,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const defaultLanguage = languages.includes(initialLanguage)
    ? initialLanguage
    : (languages[0] ?? "en");
  const [language, setLanguage] = useState(defaultLanguage);

  // initialStoreId === null means "HQ / not assigned to a store" — the user
  // explicitly checked the HQ box on a previous run. Distinguish that from
  // a fresh user with no selection yet.
  const initialIsHq = mode === "reconfirm" && initialStoreId === null;
  const [hq, setHq] = useState(initialIsHq);
  const [storeId, setStoreId] = useState<string>(
    initialStoreId ?? stores[0]?.id ?? "",
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await completeOnboarding({
        language,
        storeId: hq ? null : storeId,
      });
      if (res?.error) {
        setError(res.error);
        return;
      }
      // Bounce through root so the (now fresh) JWT routes us into the
      // unified Reels experience without a separate first-time path.
      router.push("/");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label className="mb-2 block font-mono text-xs font-medium uppercase tracking-wider text-white/55">
          Preferred language
        </label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="w-full appearance-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white transition-shadow focus:border-arctic-haze/60 focus:outline-none focus:ring-2 focus:ring-arctic-haze/40"
        >
          {languages.map((code) => (
            <option key={code} value={code} className="bg-near-black">
              {labelFor(code)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block font-mono text-xs font-medium uppercase tracking-wider text-white/55">
          Your store
        </label>
        <select
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
          disabled={hq}
          className="w-full appearance-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white transition-shadow focus:border-arctic-haze/60 focus:outline-none focus:ring-2 focus:ring-arctic-haze/40 disabled:opacity-40"
        >
          {stores.length === 0 ? (
            <option value="">— no stores configured —</option>
          ) : (
            stores.map((s) => (
              <option key={s.id} value={s.id} className="bg-near-black">
                {s.name}
                {s.city ? ` — ${s.city}` : ""}
              </option>
            ))
          )}
        </select>
        <label className="mt-3 flex items-center gap-2 text-sm text-white/80">
          <input
            type="checkbox"
            checked={hq}
            onChange={(e) => setHq(e.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-white/[0.04] text-arctic-haze accent-arctic-haze focus:ring-arctic-haze"
          />
          I'm not assigned to a store (HQ / other)
        </label>
      </div>

      {error && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-xl bg-arctic-haze px-4 py-3 font-mono text-sm font-medium uppercase tracking-wider text-near-black transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {pending ? "Saving…" : mode === "reconfirm" ? "Confirm" : "Continue"}
      </button>
    </form>
  );
}
