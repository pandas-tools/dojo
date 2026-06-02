"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";
import { addAllowedDomain, removeAllowedDomain } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function DomainsEditor({
  clientId,
  domains,
}: {
  clientId: string;
  domains: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await addAllowedDomain({ clientId, domain: draft });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Added ${draft}`);
      setDraft("");
      router.refresh();
    });
  }

  function onRemove(domain: string) {
    startTransition(async () => {
      await removeAllowedDomain({ clientId, domain });
      toast.success(`Removed ${domain}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <form onSubmit={onAdd} className="flex gap-2">
        <Input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="orange.be"
          className="font-mono flex-1"
        />
        <Button type="submit" disabled={pending || !draft.trim()}>
          Add
        </Button>
      </form>

      {domains.length === 0 ? (
        <p className="text-sm text-zinc-500">No allowed domains yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {domains.map((d) => (
            <li
              key={d}
              className="inline-flex items-center gap-1 rounded-full bg-zinc-100 pl-2.5 pr-1 py-0.5 text-xs font-mono text-zinc-700 border border-zinc-200"
            >
              {d}
              <button
                type="button"
                onClick={() => onRemove(d)}
                disabled={pending}
                aria-label={`Remove ${d}`}
                className="rounded-full p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-red-700 disabled:opacity-50 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
