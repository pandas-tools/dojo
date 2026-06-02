"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { addLanguage, removeLanguage } from "../actions";
import { cn } from "@/lib/cn";

const LANGS = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "nl", label: "Nederlands" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
];

export default function LanguagesEditor({
  clientId,
  languages,
}: {
  clientId: string;
  languages: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const enabled = new Set(languages);

  function toggle(code: string, label: string) {
    const wasOn = enabled.has(code);
    startTransition(async () => {
      if (wasOn) {
        await removeLanguage({ clientId, language: code });
        toast.success(`Disabled ${label}`);
      } else {
        await addLanguage({ clientId, language: code });
        toast.success(`Enabled ${label}`);
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {LANGS.map((l) => {
        const isOn = enabled.has(l.code);
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => toggle(l.code, l.label)}
            disabled={pending}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              "disabled:opacity-50",
              isOn
                ? "bg-zinc-900 text-white border-zinc-900 hover:bg-zinc-800"
                : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400",
            )}
          >
            {isOn && <Check className="h-3 w-3" />}
            {l.label}
            <span
              className={cn(
                "font-mono text-[10px]",
                isOn ? "text-zinc-300" : "text-zinc-400",
              )}
            >
              {l.code}
            </span>
          </button>
        );
      })}
    </div>
  );
}
