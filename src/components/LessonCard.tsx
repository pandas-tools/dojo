import Link from "next/link";
import { Play } from "lucide-react";
import { cn } from "@/lib/cn";
import BookmarkButton from "@/app/browse/BookmarkButton";
import type { BrowseCard } from "@/lib/browse";

/**
 * LessonCard — single video/image/carousel tile in the Library rails.
 *
 * Matches the Figma file (node 96:399 cards):
 *   - 154px wide × 221px tall, rounded-[8px]
 *   - Cover image with dark gradient overlay
 *   - Bookmark icon top-right (28px circular)
 *   - Play circle centered (Video only, when ready)
 *   - 3px arctic-haze progress bar at the bottom edge (Video, when partial)
 *   - 12px Sharp Grotesk Book title below the card
 */
export default function LessonCard({ card }: { card: BrowseCard }) {
  const isVideo = card.contentType === "video";
  // Single-card "in-progress" hint: visual only, not wired to real progress
  // yet (chapter-completed event lives in Phase 2 work with Dex).
  const showProgress = isVideo && card.ready && !card.completed;
  const progressPct = card.completed ? 100 : showProgress ? 35 : 0;

  return (
    <div className="flex w-[154px] shrink-0 flex-col gap-3">
      <div className="relative h-[221px] w-[154px] overflow-hidden rounded-[8px] bg-zinc-900">
        {card.ready && card.thumbnail ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={card.thumbnail}
            alt=""
            // object-contain so landscape thumbnails are never cropped —
            // the card's portrait aspect would otherwise crop the sides.
            // Letterboxing top/bottom is the acceptable trade.
            className="absolute inset-0 h-full w-full object-contain"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[11px] text-white/30">
            {card.ready ? "No preview" : "Processing"}
          </div>
        )}

        {/* Soft bottom gradient — keeps the bookmark + progress-bar area
            readable against any thumbnail content (only ~30% of card height) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[40%]"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(14,16,21,0) 0%, rgba(14,16,21,0.85) 100%)",
          }}
        />

        {/* Play affordance — bottom-left corner so it doesn't bury the
            thumbnail's title/copy in the middle. Only for ready Video. */}
        {isVideo && card.ready && (
          <div
            aria-hidden
            className="absolute bottom-2 left-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 backdrop-blur-sm"
          >
            <Play className="h-3.5 w-3.5 translate-x-px text-white" fill="currentColor" />
          </div>
        )}

        {/* Completed pill — only when card.completed */}
        {card.completed && (
          <div className="absolute left-2 top-2 rounded-full bg-arctic-haze px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-near-black">
            Done
          </div>
        )}

        {/* Bookmark icon — Figma puts it top-right inside the cover */}
        <div className="absolute right-2 top-2">
          <BookmarkButton
            lessonId={card.id}
            initialBookmarked={card.isBookmarked}
          />
        </div>

        {/* Progress bar — 3px arctic-haze at the bottom edge */}
        {isVideo && card.ready && (
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/15">
            <div
              className="h-full bg-arctic-haze transition-[width] duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}
      </div>

      <p
        className={cn(
          "line-clamp-2 text-[12px] leading-[1.3] text-white",
          "min-h-[2.6em]",
        )}
      >
        {card.title}
      </p>
    </div>
  );
}

export function LessonCardLink({
  card,
  className,
}: {
  card: BrowseCard;
  className?: string;
}) {
  if (!card.ready) {
    return (
      <div className={cn("snap-start", className)} aria-disabled>
        <LessonCard card={card} />
      </div>
    );
  }
  return (
    <Link href={`/watch/${card.id}`} className={cn("snap-start", className)}>
      <LessonCard card={card} />
    </Link>
  );
}
