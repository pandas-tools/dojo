"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export default function AuditLogFilters({
  currentAction,
  currentTargetType,
  actionNamespaces,
  targetTypes,
}: {
  currentAction: string;
  currentTargetType: string;
  actionNamespaces: string[];
  targetTypes: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function apply(patch: Record<string, string>) {
    const params = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    params.delete("before");
    const qs = params.toString();
    startTransition(() => router.push(qs ? `/admin/audit-log?${qs}` : "/admin/audit-log"));
  }

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3 flex flex-wrap items-end gap-3">
      <div className="min-w-[10rem]">
        <label className="block text-xs font-medium text-zinc-600 mb-1">
          Action
        </label>
        <select
          value={currentAction}
          onChange={(e) => apply({ action: e.target.value })}
          disabled={pending}
          className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          <option value="">All actions</option>
          {actionNamespaces.map((ns) => (
            <option key={ns} value={`${ns}.*`}>
              {ns}.*
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-[10rem]">
        <label className="block text-xs font-medium text-zinc-600 mb-1">
          Target type
        </label>
        <select
          value={currentTargetType}
          onChange={(e) => apply({ targetType: e.target.value })}
          disabled={pending}
          className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          <option value="">All targets</option>
          {targetTypes.map((tt) => (
            <option key={tt} value={tt}>
              {tt}
            </option>
          ))}
        </select>
      </div>

      {(currentAction || currentTargetType || searchParams.get("actor")) && (
        <button
          type="button"
          onClick={() => apply({ action: "", targetType: "", actor: "" })}
          disabled={pending}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:border-zinc-500 disabled:opacity-50 transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
