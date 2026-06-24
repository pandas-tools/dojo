"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import ReorderButtons from "./ReorderButtons";
import EditTierDialog from "./EditTierDialog";
import { deleteTier } from "./actions";

export type TierRow = {
  id: string;
  name: string;
  emoji: string;
  minPct: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
};

export default function TiersTable({ rows }: { rows: TierRow[] }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
      <div className="hidden sm:grid grid-cols-[auto_1fr_auto_auto] gap-4 px-4 py-2.5 border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wider text-zinc-500">
        <span>Order</span>
        <span>Tier</span>
        <span className="text-right">Threshold</span>
        <span className="text-right">Actions</span>
      </div>
      <ul className="divide-y divide-zinc-100">
        {rows.map((row) => (
          <Row key={row.id} row={row} />
        ))}
      </ul>
    </div>
  );
}

function Row({ row }: { row: TierRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (
      !window.confirm(
        `Delete the "${row.name}" tier? Employees will be reclassified into the remaining tiers.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await deleteTier({ id: row.id });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(`Deleted "${row.name}"`);
      router.refresh();
    });
  }

  return (
    <li className="grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-4 py-3">
      <ReorderButtons
        tierId={row.id}
        canMoveUp={row.canMoveUp}
        canMoveDown={row.canMoveDown}
      />

      <div className="flex items-center gap-3 min-w-0">
        <span className="text-xl leading-none" aria-hidden>
          {row.emoji}
        </span>
        <span className="font-medium text-zinc-900 truncate">{row.name}</span>
      </div>

      <div className="text-right text-sm tabular-nums text-zinc-600">
        {Math.round(row.minPct * 100)}%
      </div>

      <div className="col-span-3 sm:col-span-1 flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          disabled={pending}
          aria-label={`Edit ${row.name}`}
          className={cn(
            "h-8 w-8 rounded-md flex items-center justify-center",
            "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors",
            "disabled:opacity-40 disabled:cursor-not-allowed",
          )}
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          aria-label={`Delete ${row.name}`}
          className={cn(
            "h-8 w-8 rounded-md flex items-center justify-center",
            "text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors",
            "disabled:opacity-40 disabled:cursor-not-allowed",
          )}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </button>
      </div>

      <EditTierDialog
        open={editing}
        onOpenChange={setEditing}
        tier={{
          id: row.id,
          name: row.name,
          emoji: row.emoji,
          minPct: row.minPct,
        }}
      />
    </li>
  );
}
