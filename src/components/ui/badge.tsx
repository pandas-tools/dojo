import * as React from "react";
import { cn } from "@/lib/cn";

type Variant = "neutral" | "success" | "warning" | "destructive" | "info" | "brand";

// Functional signal colors stay muted (per brand-rules.md). Brand variant
// uses arctic-haze so admin can flag "this is a brand-aligned state."
const variantClasses: Record<Variant, string> = {
  neutral: "bg-paper-dusk text-near-black/75 border-border",
  success: "bg-success/10 text-success border-success/25",
  warning: "bg-warning/10 text-warning border-warning/25",
  destructive: "bg-destructive/10 text-destructive border-destructive/25",
  info: "bg-arctic-haze/15 text-brand-deep border-arctic-haze/30",
  brand: "bg-arctic-haze text-near-black border-arctic-haze",
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

export function Badge({
  className,
  variant = "neutral",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
