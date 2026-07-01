import Link from "next/link";
import { cn } from "@/lib/cn";
import BookmarkButton from "@/app/browse/BookmarkButton";
import type { BrowseCard } from "@/lib/browse";

/**
 * LessonCard — single video/image/carousel tile in the Library rails.
 *
 *   - 154px wide × 221px tall, rounded-[8px]
 *   - object-cover thumbnail — fills the tile edge-to-edge
 *   - bottom-anchored dark gradient gives the bookmark contrast
 *   - bookmark icon bottom-right (red when saved)
 *   - 3px progress bar at the bottom edge (full track white/15, fill
 *     arctic-haze)
 *   - 12px Sharp Grotesk Book title below the card
 */
export default function LessonCard({ card }: { card: BrowseCard }) {
  const isVideo = card.contentType === "video";
  // Visual progress placeholder until per-lesson progress wiring lands.
  // Completed = full, ready unwatched = mostly empty.
  const progressPct = card.completed ? 100 : isVideo && card.ready ? 18 : 0;

  return (
    <div
      className={cn(
        "flex w-[154px] shrink-0 flex-col gap-3",
        card.completed && "opacity-70",
      )}
    >
      <div className="relative h-[221px] w-[154px] overflow-hidden rounded-[8px] bg-zinc-900">
        {card.ready && card.thumbnail ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={card.thumbnail}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[11px] text-white/30">
            {card.ready ? "No preview" : "Processing"}
          </div>
        )}

        {/* Bottom gradient — gives the bookmark icon contrast without a
            per-icon drop-shadow. Tuned to about 40% of the card height. */}
        {card.ready && card.thumbnail && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/70 to-transparent"
          />
        )}

        {/* Watched badge — top-right when the user has completed this
            lesson. Same arctic-haze-ring + dark check treatment as the
            SuccessCard glyph (src/components/SuccessCard.tsx), scaled to
            a 20px tile-corner badge. */}
        {card.completed && (
          <div
            aria-label="Watched"
            role="img"
            className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-arctic-haze shadow-[0_1px_2px_rgba(0,0,0,0.25)]"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3 w-3 text-[#0e0e0e]"
              aria-hidden
            >
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </div>
        )}

        {/* Bookmark icon — bottom-right of cover */}
        <div className="absolute bottom-1.5 right-1.5">
          <BookmarkButton
            lessonId={card.id}
            initialBookmarked={card.isBookmarked}
          />
        </div>

        {/* Progress bar — 3px at the bottom edge (Figma: light track + fill) */}
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
