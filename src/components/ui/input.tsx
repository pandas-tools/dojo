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
          "h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900",
          "placeholder:text-zinc-400",
          "focus:border-zinc-900 focus:outline-none focus:ring-0",
          "disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400",
          "transition-colors duration-150 ease-out",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
