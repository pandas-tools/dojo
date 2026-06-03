"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Circle, Trash2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import ReorderButtons from "./ReorderButtons";
import {
  bulkSetPublish,
  bulkDelete,
  bulkAssignToClient,
  bulkUnassignFromClient,
} from "./actions";

export type LessonRow = {
  id: string;
  internalName: string;
  type: string;
  isPublished: boolean;
  firstTranslationTitle: string | null;
  translations: Array<{
    id: string;
    language: string;
    muxState: "ready" | "processing" | "empty";
  }>;
  assignmentClientIds: string[];
};

const TYPE_LABEL: Record<string, string> = {
  training: "Training",
  announcement: "Announcement",
  update: "Update",
};

export default function LessonsTable({
  rows,
  clients,
}: {
  rows: LessonRow[];
  clients: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const clientNameById = useMemo(
    () => new Map(clients.map((c) => [c.id, c.name])),
    [clients],
  );

  const allSelected =
    rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someSelected = selected.size > 0 && !allSelected;

  function toggleAll() {
    if (selected.size === rows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((r) => r.id)));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function runBulk(
    label: string,
    action: () => Promise<{ count?: number; error?: string }>,
  ) {
    startTransition(async () => {
      const res = await action();
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.count !== undefined
          ? `${label} · ${res.count} lesson${res.count === 1 ? "" : "s"}`
          : label,
      );
      clearSelection();
      router.refresh();
    });
  }

  function onBulkPublish(publish: boolean) {
    runBulk(publish ? "Published" : "Unpublished", () =>
      bulkSetPublish({
        lessonIds: Array.from(selected),
        isPublished: publish,
      }),
    );
  }

  function onBulkDelete() {
    if (
      !confirm(
        `Permanently delete ${selected.size} lesson${selected.size === 1 ? "" : "s"}? Their translations, assignments, and completions go with them.`,
      )
    )
      return;
    runBulk("Deleted", () => bulkDelete({ lessonIds: Array.from(selected) }));
  }

  function onBulkAssign(clientId: string) {
    if (!clientId) return;
    runBulk("Assigned", () =>
      bulkAssignToClient({
        lessonIds: Array.from(selected),
        clientId,
      }),
    );
  }

  function onBulkUnassign(clientId: string) {
    if (!clientId) return;
    runBulk("Unassigned", () =>
      bulkUnassignFromClient({
        lessonIds: Array.from(selected),
        clientId,
      }),
    );
  }

  const selectionActive = selected.size > 0;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
      {selectionActive && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-zinc-900 text-white px-3 py-2">
          <span className="text-xs font-medium">
            {selected.size} selected
          </span>
          <div className="ml-2 flex flex-wrap gap-1.5">
            <BulkButton onClick={() => onBulkPublish(true)} disabled={pending}>
              Publish
            </BulkButton>
            <BulkButton onClick={() => onBulkPublish(false)} disabled={pending}>
              Unpublish
            </BulkButton>
            <BulkClientPicker
              label="Assign to…"
              clients={clients}
              onPick={onBulkAssign}
              disabled={pending}
            />
            <BulkClientPicker
              label="Unassign from…"
              clients={clients}
              onPick={onBulkUnassign}
              disabled={pending}
            />
            <BulkButton
              onClick={onBulkDelete}
              disabled={pending}
              variant="destructive"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </BulkButton>
          </div>
          <button
            type="button"
            onClick={clearSelection}
            disabled={pending}
            aria-label="Clear selection"
            className="ml-auto rounded p-1 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              <th className="px-3 py-2.5 w-10">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-zinc-300 align-middle accent-zinc-900"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                  aria-label="Select all lessons"
                />
              </th>
              <th className="px-4 py-2.5 w-20">Order</th>
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">Translations</th>
              <th className="px-4 py-2.5">Assigned to</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l, i) => {
              const isSelected = selected.has(l.id);
              return (
                <tr
                  key={l.id}
                  className={cn(
                    "border-b last:border-b-0 border-zinc-100 transition-colors",
                    isSelected ? "bg-emerald-50/40" : "hover:bg-zinc-50/60",
                  )}
                >
                  <td className="px-3 py-3 align-middle">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-zinc-300 align-middle accent-zinc-900"
                      checked={isSelected}
                      onChange={() => toggleOne(l.id)}
                      aria-label={`Select ${l.internalName}`}
                    />
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <ReorderButtons
                      lessonId={l.id}
                      canMoveUp={i > 0}
                      canMoveDown={i < rows.length - 1}
                    />
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="font-medium text-zinc-900">
                      {l.internalName}
                    </div>
                    {l.firstTranslationTitle && (
                      <div className="text-xs text-zinc-500 mt-0.5 truncate max-w-xs">
                        {l.firstTranslationTitle}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <span className="text-zinc-700 text-xs">
                      {TYPE_LABEL[l.type] ?? l.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    {l.translations.length === 0 ? (
                      <span className="text-zinc-400 text-xs">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {l.translations.map((t) => (
                          <span
                            key={t.id}
                            className="inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-mono uppercase text-zinc-700"
                            title={
                              t.muxState === "ready"
                                ? "Video ready"
                                : t.muxState === "processing"
                                  ? "Video processing"
                                  : "No video"
                            }
                          >
                            {t.language}
                            {t.muxState === "ready" ? (
                              <Circle className="h-1.5 w-1.5 fill-emerald-500 text-emerald-500" />
                            ) : t.muxState === "processing" ? (
                              <Circle className="h-1.5 w-1.5 fill-amber-500 text-amber-500 animate-pulse" />
                            ) : (
                              <Circle className="h-1.5 w-1.5 fill-zinc-300 text-zinc-300" />
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    {l.assignmentClientIds.length === 0 ? (
                      <span className="text-zinc-400 text-xs">—</span>
                    ) : l.assignmentClientIds.length <= 2 ? (
                      <span className="text-zinc-700 text-xs">
                        {l.assignmentClientIds
                          .map((id) => clientNameById.get(id) ?? id)
                          .join(", ")}
                      </span>
                    ) : (
                      <span className="text-zinc-700 text-xs">
                        {l.assignmentClientIds.length} clients
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    {l.isPublished ? (
                      <Badge variant="success">Published</Badge>
                    ) : (
                      <Badge variant="neutral">Draft</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 align-middle text-right">
                    <Link
                      href={`/admin/lessons/${l.id}`}
                      className="text-zinc-500 hover:text-zinc-900 text-xs transition-colors"
                    >
                      Manage →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BulkButton({
  children,
  onClick,
  disabled,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "destructive";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50",
        variant === "destructive"
          ? "bg-red-600 text-white hover:bg-red-500"
          : "bg-white/10 text-white hover:bg-white/20",
      )}
    >
      {children}
    </button>
  );
}

function BulkClientPicker({
  label,
  clients,
  onPick,
  disabled,
}: {
  label: string;
  clients: Array<{ id: string; name: string }>;
  onPick: (clientId: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      defaultValue=""
      disabled={disabled || clients.length === 0}
      onChange={(e) => {
        const v = e.target.value;
        e.target.value = "";
        if (v) onPick(v);
      }}
      className="rounded-md bg-white/10 text-white text-xs font-medium px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-white/30 disabled:opacity-50 cursor-pointer"
    >
      <option value="" disabled>
        {label}
      </option>
      {clients.map((c) => (
        <option key={c.id} value={c.id} className="text-zinc-900 bg-white">
          {c.name}
        </option>
      ))}
    </select>
  );
}
