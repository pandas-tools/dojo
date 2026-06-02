"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { togglePublish } from "../actions";
import { cn } from "@/lib/cn";

export default function PublishToggle({
  lessonId,
  isPublished,
}: {
  lessonId: string;
  isPublished: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function flip() {
    startTransition(async () => {
      await togglePublish(lessonId, !isPublished);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={flip}
      disabled={pending}
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-3 h-9 text-sm font-medium transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        isPublished
          ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
          : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400",
      )}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isPublished ? (
        <CheckCircle2 className="h-4 w-4" />
      ) : (
        <Circle className="h-4 w-4 text-zinc-400" />
      )}
      {isPublished ? "Published" : "Publish lesson"}
    </button>
  );
}
