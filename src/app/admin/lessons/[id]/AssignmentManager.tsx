"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { assignToClient, unassignFromClient } from "../actions";
import { cn } from "@/lib/cn";

type ClientRow = { id: string; name: string };

export default function AssignmentManager({
  lessonId,
  clients,
  assignedIds,
}: {
  lessonId: string;
  clients: ClientRow[];
  assignedIds: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const assigned = new Set(assignedIds);

  function toggle(client: ClientRow) {
    const wasAssigned = assigned.has(client.id);
    startTransition(async () => {
      if (wasAssigned) {
        await unassignFromClient(lessonId, client.id);
        toast.success(`Unassigned from ${client.name}`);
      } else {
        await assignToClient(lessonId, client.id);
        toast.success(`Assigned to ${client.name}`);
      }
      router.refresh();
    });
  }

  if (clients.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No clients configured yet. Create one to assign lessons.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {clients.map((c) => {
        const isAssigned = assigned.has(c.id);
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => toggle(c)}
            disabled={pending}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              "disabled:opacity-50",
              isAssigned
                ? "bg-zinc-900 text-white border-zinc-900 hover:bg-zinc-800"
                : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400",
            )}
          >
            {isAssigned && <Check className="h-3 w-3" />}
            {c.name}
          </button>
        );
      })}
    </div>
  );
}
