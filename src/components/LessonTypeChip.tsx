import { ImageIcon, Layers, Play } from "lucide-react";
import { cn } from "@/lib/cn";

type ContentType = "video" | "image" | "carousel";

const ICON: Record<ContentType, typeof Play> = {
  video: Play,
  image: ImageIcon,
  carousel: Layers,
};

/**
 * Format a duration in seconds as a short human chip:
 *   - < 60s → "45s"
 *   - >= 60s → "Xm" (rounded up so a 65s video reads "2m" not "1m")
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.ceil(seconds / 60)}m`;
}

/**
 * Small overlay chip placed bottom-left of a lesson poster. Shows the
 * content type icon and (for videos) the duration. Backdrop-blurred dark
 * pill so it's legible on any poster.
 */
export default function LessonTypeChip({
  contentType,
  durationSeconds,
  className,
}: {
  contentType: ContentType;
  durationSeconds: number | null;
  className?: string;
}) {
  const Icon = ICON[contentType];
  const showDuration = contentType === "video" && durationSeconds != null && durationSeconds > 0;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-near-black/65 px-1.5 py-0.5 ring-1 ring-white/10 backdrop-blur-md",
        className,
      )}
    >
      <Icon
        className={cn(
          "h-3 w-3 text-white",
          contentType === "video" && "fill-white translate-x-[0.5px]",
        )}
        strokeWidth={2.25}
      />
      {showDuration && (
        <span className="font-mono text-[10px] font-medium text-white tabular-nums">
          {formatDuration(durationSeconds)}
        </span>
      )}
    </div>
  );
}
