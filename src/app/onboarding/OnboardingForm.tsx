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
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          Preferred language
        </label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          {languages.map((code) => (
            <option key={code} value={code}>
              {labelFor(code)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          Your store
        </label>
        <select
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
          disabled={hq}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:bg-zinc-50 disabled:text-zinc-400"
        >
          {stores.length === 0 ? (
            <option value="">— no stores configured —</option>
          ) : (
            stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.city ? ` — ${s.city}` : ""}
              </option>
            ))
          )}
        </select>
        <label className="mt-2 flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={hq}
            onChange={(e) => setHq(e.target.checked)}
            className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
          />
          I'm not assigned to a store (HQ / other)
        </label>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300 transition-colors"
      >
        {pending ? "Saving…" : mode === "reconfirm" ? "Confirm" : "Continue"}
      </button>
    </form>
  );
}
