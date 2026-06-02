"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { reorderLesson } from "./actions";

type Props = {
  lessonId: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
};

export default function ReorderButtons({
  lessonId,
  canMoveUp,
  canMoveDown,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function move(direction: "up" | "down") {
    startTransition(async () => {
      await reorderLesson({ lessonId, direction });
      router.refresh();
    });
  }

  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => move("up")}
        disabled={!canMoveUp || pending}
        aria-label="Move up"
        className="h-7 w-7 rounded border border-zinc-300 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        ↑
      </button>
      <button
        type="button"
        onClick={() => move("down")}
        disabled={!canMoveDown || pending}
        aria-label="Move down"
        className="h-7 w-7 rounded border border-zinc-300 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        ↓
      </button>
    </div>
  );
}
