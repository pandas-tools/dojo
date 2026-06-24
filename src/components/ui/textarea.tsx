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
          "w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-near-black",
          "placeholder:text-muted-foreground/70",
          "focus:border-brand-deep focus:outline-none focus:ring-0",
          "disabled:cursor-not-allowed disabled:bg-snowglint disabled:text-muted-foreground/70",
          "transition-colors duration-150 ease-out resize-y",
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";
