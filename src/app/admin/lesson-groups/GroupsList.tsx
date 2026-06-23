"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronUp,
  ChevronDown,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import {
  reorderGroup,
  renameGroup,
  deleteGroup,
} from "./actions";

export type GroupRow = {
  id: string;
  name: string;
  lessonCount: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
};

export default function GroupsList({
  rows,
  ungroupedCount,
}: {
  rows: GroupRow[];
  ungroupedCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  function move(group: GroupRow, direction: "up" | "down") {
    startTransition(async () => {
      const res = await reorderGroup({ groupId: group.id, direction });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  function startEdit(group: GroupRow) {
    setEditingId(group.id);
    setDraft(group.name);
  }

  function saveEdit(group: GroupRow) {
    const name = draft.trim();
    if (!name || name === group.name) {
      setEditingId(null);
      return;
    }
    startTransition(async () => {
      const res = await renameGroup({ groupId: group.id, name });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Renamed");
      setEditingId(null);
      router.refresh();
    });
  }

  function remove(group: GroupRow) {
    const msg =
      group.lessonCount > 0
        ? `Delete "${group.name}"? Its ${group.lessonCount} lesson${group.lessonCount === 1 ? "" : "s"} will become ungrouped (not deleted).`
        : `Delete "${group.name}"?`;
    if (!window.confirm(msg)) return;
    startTransition(async () => {
      const res = await deleteGroup({ groupId: group.id });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(`Deleted "${group.name}"`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <ul className="rounded-lg border border-zinc-200 bg-white divide-y divide-zinc-100 overflow-hidden">
        {rows.map((group) => {
          const isEditing = editingId === group.id;
          return (
            <li
              key={group.id}
              className="flex items-center gap-3 px-3 py-2.5"
            >
              {/* Reorder */}
              <div className="inline-flex items-center -space-x-px">
                <button
                  type="button"
                  onClick={() => move(group, "up")}
                  disabled={!group.canMoveUp || pending}
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
                  onClick={() => move(group, "down")}
                  disabled={!group.canMoveDown || pending}
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

              {/* Name / inline edit */}
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(group);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      autoFocus
                      maxLength={80}
                      className="w-full max-w-xs rounded-md border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-zinc-500"
                    />
                    <button
                      type="button"
                      onClick={() => saveEdit(group)}
                      disabled={pending}
                      aria-label="Save"
                      className="h-7 w-7 rounded-md flex items-center justify-center text-emerald-600 hover:bg-emerald-50"
                    >
                      {pending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      aria-label="Cancel"
                      className="h-7 w-7 rounded-md flex items-center justify-center text-zinc-400 hover:bg-zinc-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <Link
                    href={`/admin/lesson-groups/${group.id}`}
                    className="font-medium text-sm text-zinc-900 hover:underline truncate"
                  >
                    {group.name}
                  </Link>
                )}
              </div>

              {/* Count + actions */}
              {!isEditing && (
                <>
                  <span className="text-xs text-zinc-500 tabular-nums">
                    {group.lessonCount} lesson
                    {group.lessonCount === 1 ? "" : "s"}
                  </span>
                  <Link
                    href={`/admin/lesson-groups/${group.id}`}
                    className="text-xs text-zinc-600 hover:text-zinc-900 underline underline-offset-2"
                  >
                    Manage lessons
                  </Link>
                  <button
                    type="button"
                    onClick={() => startEdit(group)}
                    disabled={pending}
                    aria-label="Rename"
                    className="h-7 w-7 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(group)}
                    disabled={pending}
                    aria-label="Delete"
                    className="h-7 w-7 rounded-md flex items-center justify-center text-zinc-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-zinc-500">
        {ungroupedCount} lesson{ungroupedCount === 1 ? "" : "s"} not in any
        group. Ungrouped lessons still appear on /browse under a &ldquo;More
        lessons&rdquo; section.
      </p>
    </div>
  );
}
