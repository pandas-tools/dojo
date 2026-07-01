"use client";

import { useState } from "react";
import { Drawer } from "vaul";

/**
 * VideoNotesSheet — bottom sheet that surfaces the lesson's notes content.
 * Matches Figma node 96:295 (Video_Notes panel). Two snap points: a peek
 * (half the viewport, video still visible above) and an expanded view
 * (near full screen). The top handle is the only drag surface; the notes
 * body scrolls freely once the sheet is expanded.
 */

const SNAP_POINTS = ["55%", "92%"] as const;

export default function VideoNotesSheet({
  open,
  onOpenChange,
  notesMarkdown,
  lessonTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notesMarkdown: string | null;
  lessonTitle?: string;
}) {
  const [snap, setSnap] = useState<number | string | null>(SNAP_POINTS[0]);

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(next) => {
        // Reset to the peek snap on every open so the sheet always
        // animates in at the smaller height regardless of where the
        // user left it last time.
        if (next) setSnap(SNAP_POINTS[0]);
        onOpenChange(next);
      }}
      snapPoints={[...SNAP_POINTS]}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
      handleOnly
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
          {/* Drag handle — the thin rectangle at the top. vaul wires the
              drag onto this element when handleOnly is set. */}
          <Drawer.Handle
            preventCycle
            className="!mx-auto !mt-3 !mb-6 !h-1 !w-10 !flex-shrink-0 !rounded-full !bg-white/25"
          />

          <div className="flex-1 overflow-y-auto overscroll-contain px-10 pb-12">
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
