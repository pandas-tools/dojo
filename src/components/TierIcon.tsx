import { cn } from "@/lib/cn";

/**
 * TierIcon — renders the Figma tier emblem for a given tier. Mapping is by
 * sortOrder so that translated tier names still resolve to the right icon
 * (0 → Apprentice belt, 1 → Specialist wave, 2 → Expert trophy).
 *
 * Icons live under /public/img/tiers/ and are the exact PNGs exported from
 * the Figma file (node 122:3489 — bottom-sheet-playful, source assets
 * Rectangle34627652/653/654).
 */
const TIER_SLUG_BY_SORT = ["apprentice", "specialist", "expert"] as const;

export default function TierIcon({
  sortOrder,
  name,
  className,
}: {
  sortOrder: number;
  name: string;
  className?: string;
}) {
  const slug =
    TIER_SLUG_BY_SORT[sortOrder] ?? TIER_SLUG_BY_SORT[0];
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/img/tiers/${slug}.png`}
      alt={name}
      className={cn("object-contain", className)}
      draggable={false}
    />
  );
}
