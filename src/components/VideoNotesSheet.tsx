"use client";

import * as Dialog from "@radix-ui/react-dialog";

/**
 * VideoNotesSheet — bottom sheet that surfaces the lesson's notes content.
 * Matches the Figma file (node 96:295 — Video_Notes panel). The Figma
 * shows the notes as a dedicated screen below a smaller video; we render
 * it as a slide-up sheet over the active lesson so the user can dismiss
 * back to the video without losing scroll position.
 *
 * Notes content is currently rendered as preformatted markdown text.
 * When markdown rendering is needed (headings, bold, lists), wire react-
 * markdown here.
 */
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
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0"
        />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 max-h-[75dvh] overflow-y-auto rounded-t-[40px] border-t border-white/10 px-10 pb-12 pt-10 text-[#f9fdff] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom-full data-[state=closed]:slide-out-to-bottom-full"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(68,81,88,0.4) 0%, rgba(14,14,14,0.95) 100%), linear-gradient(90deg, rgba(14,14,14,0.95) 0%, rgba(14,14,14,0.95) 100%)",
          }}
        >
          {/* Drag handle */}
          <div
            aria-hidden
            className="mx-auto mb-6 h-1 w-10 rounded-full bg-white/20"
          />

          <Dialog.Title className="text-[32px] font-medium leading-[1.2] tracking-tight text-[#f9fdff]">
            Notes
          </Dialog.Title>
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

          <Dialog.Close
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
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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
