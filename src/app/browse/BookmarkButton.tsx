"use client";

import { useState, useTransition } from "react";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";
import { toggleBookmark } from "./actions";
import { cn } from "@/lib/cn";

export default function BookmarkButton({
  lessonId,
  initialBookmarked,
}: {
  lessonId: string;
  initialBookmarked: boolean;
}) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [pending, startTransition] = useTransition();

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !bookmarked;
    setBookmarked(next);
    startTransition(async () => {
      const res = await toggleBookmark(lessonId);
      if ("error" in res) {
        setBookmarked(!next);
        toast.error("Couldn't update bookmark");
        return;
      }
      setBookmarked(res.bookmarked);
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={bookmarked}
      aria-label={bookmarked ? "Remove bookmark" : "Save lesson"}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full",
        "transition-[transform,color] duration-150 ease-out",
        "disabled:opacity-60 active:scale-90",
        bookmarked
          ? "text-arctic-haze drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
          : "text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] hover:text-white",
      )}
    >
      <Bookmark
        className={cn("h-6 w-6", bookmarked ? "fill-current" : "stroke-[2.25]")}
      />
    </button>
  );
}
