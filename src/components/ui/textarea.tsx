"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, rows = 3, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(
          "w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900",
          "placeholder:text-zinc-400",
          "focus:border-zinc-900 focus:outline-none focus:ring-0",
          "disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400",
          "transition-colors duration-150 ease-out resize-y",
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";
