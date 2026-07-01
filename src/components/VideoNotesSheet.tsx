"use client";

import { Drawer } from "vaul";

/**
 * VideoNotesSheet — bottom sheet that surfaces the lesson's notes content.
 * Matches Figma node 96:295 (Video_Notes panel). Two snap points: a peek
 * (half the viewport, video still visible above) and an expanded view
 * (near full screen). The top handle is the only drag surface; the notes
 * body scrolls freely once the sheet is expanded.
 *
 * Snap state lives in the parent (ReelsFeed) so the video preview above
 * the drawer can track the drawer height — as the drawer grows, the
 * card shrinks, keeping the black gap between them constant.
 */

// vaul snap points are fractions of viewport height (numbers 0..1) or
// pixel strings like "500px". Percentage strings are treated as pixels
// (parseInt("55%", 10) → 55px), which collapses the drawer to a slit.
//
// vaul on release always snaps — either to closest (slow drag) or to
// activeIndex + 1 (fast flick, which is essentially every real touch
// gesture: velocity > 0.4px/ms AND distance < 40vh). Fine-grained
// snaps therefore feel stuck on flick because each "next" step is
// only ~2vh. Three semantic stops give flicks a meaningful jump and
// slow drags land at the nearest of the three.
export const NOTES_INITIAL_SNAP = 0.55;
export const NOTES_SNAP_POINTS: readonly number[] = [0.3, 0.55, 0.92];

export default function VideoNotesSheet({
  open,
  onOpenChange,
  snap,
  setSnap,
  notesMarkdown,
  lessonTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snap: number | string | null;
  setSnap: (v: number | string | null) => void;
  notesMarkdown: string | null;
  lessonTitle?: string;
}) {
  return (
    <Drawer.Root
      open={open}
      onOpenChange={(next) => {
        // Reset to the canonical peek height on every open so the sheet
        // always animates in at the same starting size regardless of
        // where the user left it last time.
        if (next) setSnap(NOTES_INITIAL_SNAP);
        onOpenChange(next);
      }}
      snapPoints={[...NOTES_SNAP_POINTS]}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/45" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 flex h-full max-h-[97dvh] flex-col rounded-t-[40px] border-t border-white/10 text-[#f9fdff] outline-none"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(68,81,88,0.4) 0%, rgba(14,14,14,0.95) 100%), linear-gradient(90deg, rgba(14,14,14,0.95) 0%, rgba(14,14,14,0.95) 100%)",
          }}
        >
          {/* Drag handle — the thin rectangle at the top. Vaul lets the
              whole drawer receive drag (handleOnly is off) because vaul's
              handle drag doesn't set pointer capture — with handleOnly on,
              any finger movement more than ~22px off the tiny handle would
              stall the drag mid-gesture. Whole-drawer drag routes through
              vaul's Content component, which distinguishes scroll from
              drag based on the body's scroll position. */}
          <Drawer.Handle
            preventCycle
            className="!mx-auto !mt-3 !mb-6 !h-1 !w-10 !flex-shrink-0 !rounded-full !bg-white/25"
          />

          {/* Notes body — height matches the visible drawer at the current
              snap so overflow-y-auto has a bounded viewport to scroll within.
              Without this, Drawer.Content's 97dvh layout height means content
              longer than the visible drawer disappears below the viewport. */}
          <div
            className="overflow-y-auto overscroll-contain px-10 pb-12"
            style={{
              height:
                typeof snap === "number"
                  ? `calc(${snap * 100}dvh - 48px)`
                  : "50dvh",
            }}
          >
            <Drawer.Title className="text-[32px] font-medium leading-[1.2] tracking-tight text-[#f9fdff]">
              Notes
            </Drawer.Title>
            {lessonTitle && (
              <p className="mt-1 text-[12px] uppercase tracking-wider text-[#f9fdff]/55">
                {lessonTitle}
              </p>
            )}

            <div className="mt-10">
              {notesMarkdown && notesMarkdown.trim().length > 0 ? (
                <div className="space-y-4 whitespace-pre-wrap text-[14px] leading-[22px] text-[#f9fdff]/85">
                  {notesMarkdown}
                </div>
              ) : (
                <EmptyNotes />
              )}
            </div>
          </div>

          <Drawer.Close
            aria-label="Close notes"
            className="absolute right-6 top-6 flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </Drawer.Close>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function EmptyNotes() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
      <p className="text-[14px] leading-[22px] text-[#f9fdff]/65">
        No notes for this lesson yet.
      </p>
      <p className="mt-1 text-[12px] leading-[18px] text-[#f9fdff]/45">
        Your store admin can add notes from the lesson admin view.
      </p>
    </div>
  );
}
