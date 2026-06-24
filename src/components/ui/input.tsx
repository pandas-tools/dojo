"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "h-9 w-full rounded-lg border border-border bg-card px-3 text-sm text-near-black",
          "placeholder:text-muted-foreground/60",
          "focus:border-brand-deep focus:outline-none focus:ring-0",
          "disabled:cursor-not-allowed disabled:bg-paper-dusk disabled:text-muted-foreground",
          "transition-colors duration-150 ease-out",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
