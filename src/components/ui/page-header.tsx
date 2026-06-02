import * as React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/cn";

export interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  back?: { href: string; label: string };
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  back,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {back && (
        <Link
          href={back.href}
          className="inline-flex w-fit items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {back.label}
        </Link>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-zinc-500 mt-1">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
