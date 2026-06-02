"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";
import {
  assignToClient,
  unassignFromClient,
} from "../../lessons/actions";
import { cn } from "@/lib/cn";

type LessonRow = { id: string; internalName: string; title: string | null };

export default function ClientLessonsAssigner({
  clientId,
  lessons,
  assignedIds,
}: {
  clientId: string;
  lessons: LessonRow[];
  assignedIds: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const assigned = new Set(assignedIds);

  function toggle(lesson: LessonRow) {
    const wasAssigned = assigned.has(lesson.id);
    const display = lesson.title ?? lesson.internalName;
    startTransition(async () => {
      if (wasAssigned) {
        await unassignFromClient(lesson.id, clientId);
        toast.success(`Removed "${display}"`);
      } else {
        await assignToClient(lesson.id, clientId);
        toast.success(`Assigned "${display}"`);
      }
      router.refresh();
    });
  }

  if (lessons.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No lessons exist yet. Create one on the{" "}
        <a
          href="/admin/lessons"
          className="text-zinc-900 underline underline-offset-2"
        >
          Lessons page
        </a>
        .
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {lessons.map((l) => {
          const isAssigned = assigned.has(l.id);
          const display = l.title ?? l.internalName;
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => toggle(l)}
              disabled={pending}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                "disabled:opacity-50",
                isAssigned
                  ? "bg-zinc-900 text-white border-zinc-900 hover:bg-zinc-800"
                  : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400",
              )}
              title={l.internalName}
            >
              {isAssigned && <Check className="h-3 w-3" />}
              {display}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-zinc-500">
        {assigned.size} of {lessons.length} lessons assigned to this client.
      </p>
    </div>
  );
}
