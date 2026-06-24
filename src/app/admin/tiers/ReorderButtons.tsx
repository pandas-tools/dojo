"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp, ChevronDown } from "lucide-react";
import { reorderTier } from "./actions";
import { cn } from "@/lib/cn";

type Props = {
  tierId: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
};

export default function ReorderButtons({
  tierId,
  canMoveUp,
  canMoveDown,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function move(direction: "up" | "down") {
    startTransition(async () => {
      await reorderTier({ id: tierId, direction });
      router.refresh();
    });
  }

  return (
    <div className="inline-flex items-center -space-x-px">
      <button
        type="button"
        onClick={() => move("up")}
        disabled={!canMoveUp || pending}
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
        onClick={() => move("down")}
        disabled={!canMoveDown || pending}
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
  );
}
