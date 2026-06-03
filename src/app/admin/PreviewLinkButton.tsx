"use client";

import { useState, useTransition } from "react";
import { Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  createClientPreviewLink,
  createLessonPreviewLink,
} from "./preview-actions";

type Mode =
  | { kind: "client"; clientId: string }
  | { kind: "lesson"; lessonId: string };

export default function PreviewLinkButton({
  mode,
  label,
}: {
  mode: Mode;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [lastUrl, setLastUrl] = useState<string | null>(null);

  const buttonLabel =
    label ??
    (mode.kind === "client" ? "Preview as employee" : "Preview this lesson");

  function onClick() {
    startTransition(async () => {
      const res =
        mode.kind === "client"
          ? await createClientPreviewLink({ clientId: mode.clientId })
          : await createLessonPreviewLink({ lessonId: mode.lessonId });
      if (res?.error || !("url" in res) || !res.url) {
        toast.error(
          (res && "error" in res ? res.error : undefined) ??
            "Couldn't mint preview link",
        );
        return;
      }
      setLastUrl(res.url);
      try {
        await navigator.clipboard.writeText(res.url);
        toast.success(
          "Preview link copied to clipboard — also opening in a new tab. Valid for 24h.",
        );
      } catch {
        toast.success(
          "Preview link opened in a new tab. Valid for 24h — copy from the address bar to paste on your phone.",
        );
      }
      window.open(res.url, "_blank", "noopener");
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="secondary"
        onClick={onClick}
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
        {pending ? "Minting…" : buttonLabel}
      </Button>
      {lastUrl && (
        <a
          href={lastUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-zinc-500 hover:text-zinc-700 underline underline-offset-2 break-all max-w-xs text-right"
        >
          {lastUrl}
        </a>
      )}
    </div>
  );
}
