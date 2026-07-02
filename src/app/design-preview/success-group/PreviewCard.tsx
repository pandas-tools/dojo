"use client";

import SuccessGroupCard from "@/components/SuccessGroupCard";

/**
 * Thin client wrapper so this route's server page can render the group
 * success card with no-op callbacks. Passing `() => {}` directly from
 * page.tsx would cross an RSC boundary, which Next.js rejects.
 */
export default function PreviewCard() {
  return <SuccessGroupCard onSubmit={() => {}} onSkip={() => {}} />;
}
