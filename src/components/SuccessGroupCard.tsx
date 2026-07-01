"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";

/**
 * SuccessGroupCard — group-completion success popup with emoji rating +
 * comment input. Matches the Figma file (node 152:2471 — Success Group).
 *
 * Layout differs from SuccessCard: left-aligned, 315px wide, no subtitle,
 * has a divider, centered "How do you feel?" label, 4-emoji rating row, and
 * a collapsible comment input.
 * Selected emoji highlights to arctic-haze; unselected stay muted at
 * #445158 (steel-harbor). Per the strictly-cool palette rule the selected
 * state uses the brand cyan rather than an emoji color shift.
 */
export type GroupRating = "bad" | "meh" | "good" | "amazing";

const RATINGS: { id: GroupRating; emoji: string; label: string }[] = [
  { id: "bad", emoji: "😢", label: "Bad" },
  { id: "meh", emoji: "😐", label: "Meh" },
  { id: "good", emoji: "😊", label: "Good" },
  { id: "amazing", emoji: "🤩", label: "Amazing" },
];

export default function SuccessGroupCard({
  icon = <span className="text-4xl leading-none">🎉</span>,
  title = "Congrats! You've just completed this group.",
  onSubmit,
}: {
  icon?: React.ReactNode;
  title?: React.ReactNode;
  onSubmit?: (input: { rating: GroupRating | null; comment: string }) => void;
}) {
  const [rating, setRating] = useState<GroupRating | null>(null);
  const [comment, setComment] = useState("");
  const [commentOpen, setCommentOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="flex w-[315px] flex-col gap-6 rounded-[16px] border border-white/[0.06] bg-[rgba(14,16,21,0.55)] px-6 py-8 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto flex h-[50px] w-[50px] items-center justify-center"
      >
        {icon}
      </motion.div>

      <h2 className="w-full text-center text-[24px] font-medium leading-[1.2] tracking-tight text-[#fefefe]">
        {title}
      </h2>

      <div aria-hidden className="h-px w-full bg-white/10" />

      <div className="flex flex-col gap-4">
        <p className="text-center text-[18px] font-medium leading-[1.2] text-[#f9fdff]">
          How do you feel?
        </p>
        <div className="flex w-full items-start justify-between">
          {RATINGS.map((r) => {
            const selected = rating === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setRating(selected ? null : r.id)}
                aria-pressed={selected}
                aria-label={`Rate ${r.label}`}
                className="flex flex-col items-center gap-1.5 transition-transform duration-200 hover:scale-110"
              >
                <span
                  className={cn(
                    "text-[40px] leading-none transition-[filter,opacity] duration-200",
                    selected
                      ? "opacity-100 [filter:drop-shadow(0_0_12px_rgba(193,232,251,0.65))]"
                      : "opacity-55",
                  )}
                >
                  {r.emoji}
                </span>
                <span
                  className={cn(
                    "text-[10px] leading-4 uppercase tracking-[0.05em] transition-colors duration-200",
                    selected ? "text-arctic-haze" : "text-[#f9fdff]/60",
                  )}
                >
                  {r.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {commentOpen ? (
        <motion.label
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="flex w-full flex-col gap-2"
        >
          <span className="sr-only">Add a comment</span>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a comment…"
            rows={3}
            autoFocus
            className="w-full resize-none rounded-[8px] border border-[#445158] bg-[rgba(68,81,88,0.2)] px-4 py-3 text-[12px] leading-4 text-[#fefefe] placeholder:text-[#b2b2b2] focus:border-arctic-haze/60 focus:outline-none focus:ring-2 focus:ring-arctic-haze/30"
          />
        </motion.label>
      ) : (
        <button
          type="button"
          onClick={() => setCommentOpen(true)}
          className="self-start text-[12px] leading-4 text-[#f9fdff]/60 underline underline-offset-2 transition-colors hover:text-arctic-haze"
        >
          Add a comment
        </button>
      )}

      {onSubmit && (
        <button
          type="button"
          onClick={() => onSubmit({ rating, comment })}
          disabled={!rating}
          className="flex h-[44px] w-full items-center justify-center rounded-full bg-arctic-haze px-4 text-[14px] font-medium text-near-black transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Submit
        </button>
      )}
    </motion.div>
  );
}
