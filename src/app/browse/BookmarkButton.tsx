"use client";

import { useState, useTransition } from "react";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";
import { toggleBookmark } from "./actions";
import { cn } from "@/lib/cn";

/**
 * Bookmark toggle for a browse card. Optimistic — flips immediately, reverts
 * on a server error. Stops event propagation so a tap on the bookmark doesn't
 * follow the card's link to /watch. Reference styling for the light page; the
 * dark /browse redesign restyles it on top of the same action contract.
 */
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
      aria-label={bookmarked ? "Remove bookmark" : "Bookmark"}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors",
        "disabled:opacity-50",
        bookmarked
          ? "bg-zinc-900 text-white hover:bg-zinc-800"
          : "border border-zinc-200 bg-white/90 text-zinc-700 hover:bg-white",
      )}
    >
      <Bookmark className={cn("h-4 w-4", bookmarked && "fill-current")} />
    </button>
  );
}
