"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

type SerializedEntry = {
  id: string;
  createdAt: string;
  actorUserId: string | null;
  actorEmail: string | null;
  actorName: string | null;
  action: string;
  targetType: string;
  targetId: string;
  payload: Record<string, unknown> | null;
};

export default function AuditLogRow({ entry }: { entry: SerializedEntry }) {
  const [open, setOpen] = useState(false);
  const hasPayload =
    entry.payload && Object.keys(entry.payload).length > 0;

  return (
    <>
      <tr
        onClick={() => hasPayload && setOpen((v) => !v)}
        className={cn(
          "border-b border-zinc-100 transition-colors",
          hasPayload && "cursor-pointer hover:bg-zinc-50",
        )}
      >
        <td className="py-2.5 px-3 align-top whitespace-nowrap text-zinc-600 text-xs">
          {formatTimestamp(entry.createdAt)}
        </td>
        <td className="py-2.5 px-3 align-top">
          <div className="min-w-0">
            <div className="text-zinc-900 truncate max-w-[14rem]">
              {entry.actorName ?? entry.actorEmail ?? "—"}
            </div>
            {entry.actorEmail && entry.actorName && (
              <div className="text-xs text-zinc-500 truncate max-w-[14rem]">
                {entry.actorEmail}
              </div>
            )}
          </div>
        </td>
        <td className="py-2.5 px-3 align-top">
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-mono text-zinc-700">
            {entry.action}
          </code>
        </td>
        <td className="py-2.5 px-3 align-top">
          <div className="text-zinc-700">
            <span className="text-xs text-zinc-500">{entry.targetType}</span>{" "}
            <code className="font-mono text-xs text-zinc-700">
              {entry.targetId}
            </code>
          </div>
        </td>
        <td className="py-2.5 px-3 align-top w-8 text-zinc-400">
          {hasPayload && (
            <ChevronRight
              className={cn(
                "h-4 w-4 transition-transform",
                open && "rotate-90",
              )}
            />
          )}
        </td>
      </tr>
      {open && hasPayload && (
        <tr className="border-b border-zinc-100">
          <td colSpan={5} className="py-3 px-3 bg-zinc-50/50">
            <pre className="text-xs font-mono text-zinc-700 whitespace-pre-wrap break-all">
              {JSON.stringify(entry.payload, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
