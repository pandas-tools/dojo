"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp, ChevronDown, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import {
  reorderLessonInGroup,
  removeLessonFromGroup,
  assignLessonToGroup,
} from "../actions";

export type MemberRow = {
  id: string;
  internalName: string;
  title: string | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
};

export type AvailableRow = {
  id: string;
  internalName: string;
  title: string | null;
  inOtherGroup: boolean;
};

export default function GroupLessonsManager({
  groupId,
  members,
  available,
}: {
  groupId: string;
  members: MemberRow[];
  available: AvailableRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ error?: string } | { ok: true }>) {
    startTransition(async () => {
      const res = await action();
      if (res && "error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      {/* Members — ordered */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-900 mb-3">
          In this group ({members.length})
        </h2>
        {members.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No lessons yet. Add some from the list below.
          </p>
        ) : (
          <ul className="rounded-lg border border-zinc-200 bg-white divide-y divide-zinc-100 overflow-hidden">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="inline-flex items-center -space-x-px">
                  <button
                    type="button"
                    onClick={() =>
                      run(() =>
                        reorderLessonInGroup({
                          lessonId: m.id,
                          direction: "up",
                        }),
                      )
                    }
                    disabled={!m.canMoveUp || pending}
                    aria-label="Move up"
                    className={cn(
                      "h-7 w-7 rounded-l-md border border-zinc-200 bg-white flex items-center justify-center",
                      "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 hover:z-10 relative",
                      "disabled:opacity-30 disabled:cursor-not-allowed transition-colors",
                    )}
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      run(() =>
                        reorderLessonInGroup({
                          lessonId: m.id,
                          direction: "down",
                        }),
                      )
                    }
                    disabled={!m.canMoveDown || pending}
                    aria-label="Move down"
                    className={cn(
                      "h-7 w-7 rounded-r-md border border-zinc-200 bg-white flex items-center justify-center",
                      "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 hover:z-10 relative",
                      "disabled:opacity-30 disabled:cursor-not-allowed transition-colors",
                    )}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 truncate">
                    {m.title ?? m.internalName}
                  </p>
                  {m.title && (
                    <p className="text-xs text-zinc-400 truncate">
                      {m.internalName}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    run(() => removeLessonFromGroup({ lessonId: m.id }))
                  }
                  disabled={pending}
                  aria-label="Remove from group"
                  className="h-7 w-7 rounded-md flex items-center justify-center text-zinc-400 hover:text-red-600 hover:bg-red-50"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Add lessons */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-900 mb-3">
          Add lessons
        </h2>
        {available.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Every lesson is already in this group.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {available.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() =>
                  run(() =>
                    assignLessonToGroup({ lessonId: l.id, groupId }),
                  )
                }
                disabled={pending}
                title={
                  l.inOtherGroup
                    ? `${l.internalName} — currently in another group; this moves it here`
                    : l.internalName
                }
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400 disabled:opacity-50",
                )}
              >
                <Plus className="h-3 w-3" />
                {l.title ?? l.internalName}
                {l.inOtherGroup && (
                  <span className="text-zinc-400">· in another group</span>
                )}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
