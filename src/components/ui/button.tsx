"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/cn";

type Variant = "primary" | "brand" | "secondary" | "ghost" | "destructive" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-near-black text-white hover:opacity-90 disabled:opacity-40",
  brand:
    "bg-arctic-haze text-near-black hover:opacity-90 disabled:opacity-40",
  secondary:
    "bg-paper-dusk text-near-black hover:bg-fogbound disabled:opacity-50",
  ghost:
    "bg-transparent text-near-black/80 hover:bg-paper-dusk hover:text-near-black disabled:opacity-40",
  destructive:
    "bg-destructive text-destructive-foreground hover:opacity-90 disabled:opacity-40",
  outline:
    "border border-border bg-card text-near-black hover:bg-paper-dusk disabled:opacity-40",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  lg: "h-10 px-5 text-sm gap-2",
  icon: "h-9 w-9 text-sm",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", asChild = false, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-150 ease-out",
          "disabled:cursor-not-allowed",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
