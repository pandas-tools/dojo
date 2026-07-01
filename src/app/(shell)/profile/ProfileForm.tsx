"use client";

import { useState, useTransition } from "react";
import { Check, LogOut } from "lucide-react";
import { toast } from "sonner";
import { signOutAction } from "../../actions";
import { updatePreferredLanguage, updateStore } from "./actions";

type Lang = { language: string; label: string };
type Store = { id: string; name: string; city: string | null };

export default function ProfileForm({
  email,
  initialLanguage,
  initialStoreId,
  languages,
  stores,
}: {
  email: string;
  initialLanguage: string;
  initialStoreId: string | null;
  languages: Lang[];
  stores: Store[];
}) {
  const [language, setLanguage] = useState(initialLanguage);
  const [storeId, setStoreId] = useState<string>(initialStoreId ?? "");
  const [pending, startTransition] = useTransition();
  const dirtyLang = language !== initialLanguage;
  const dirtyStore = storeId !== (initialStoreId ?? "");
  const dirty = dirtyLang || dirtyStore;

  function onSave() {
    startTransition(async () => {
      let ok = true;
      if (dirtyLang) {
        const res = await updatePreferredLanguage(language);
        if ("error" in res) {
          ok = false;
          toast.error("Couldn't update language");
        }
      }
      if (ok && dirtyStore && storeId) {
        const res = await updateStore(storeId);
        if ("error" in res) {
          ok = false;
          toast.error("Couldn't update store");
        }
      }
      if (ok) toast.success("Saved");
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <Field label="Email">
        <div className="text-sm text-white">{email}</div>
      </Field>

      <Field label="Language">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          disabled={pending}
          className="w-full appearance-none rounded-xl bg-white/[0.04] px-4 py-3 text-sm text-white ring-1 ring-white/10 transition-shadow focus:ring-2 focus:ring-arctic-haze/60 focus:outline-none"
        >
          {languages.map((l) => (
            <option key={l.language} value={l.language} className="bg-near-black">
              {l.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Store">
        <select
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
          disabled={pending}
          className="w-full appearance-none rounded-xl bg-white/[0.04] px-4 py-3 text-sm text-white ring-1 ring-white/10 transition-shadow focus:ring-2 focus:ring-arctic-haze/60 focus:outline-none"
        >
          {stores.map((s) => (
            <option key={s.id} value={s.id} className="bg-near-black">
              {s.name}
              {s.city ? ` — ${s.city}` : ""}
            </option>
          ))}
        </select>
      </Field>

      <button
        type="button"
        onClick={onSave}
        disabled={!dirty || pending}
        className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-arctic-haze px-4 py-3 font-mono text-sm font-medium uppercase tracking-wider text-near-black transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        <Check className="h-4 w-4" />
        {pending ? "Saving…" : dirty ? "Save changes" : "Saved"}
      </button>

      <div className="mt-8 border-t border-white/5 pt-6">
        <form action={signOutAction}>
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive ring-1 ring-destructive/25 transition-colors hover:bg-destructive/15"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 font-mono text-xs font-medium uppercase tracking-wider text-white/45">
        {label}
      </div>
      {children}
    </div>
  );
}
