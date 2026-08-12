"use client";

/**
 * Collapsible Archived section for Library lists.
 * Active items stay above; archived assets are Preview/Restore only (callers omit Use).
 */

import * as React from "react";

import { ChevronDown, ChevronRight } from "lucide-react";

import { LIBRARY_LABELS } from "@/components/library/labels";
import { cn } from "@/lib/utils";

export function LibraryArchivedSection({
  count,
  children,
  className,
  defaultOpen = false,
}: {
  count: number;
  children: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  if (count <= 0) return null;

  return (
    <section className={cn("space-y-3 border-t border-border pt-6", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left text-sm font-medium text-heading"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <span>
          {LIBRARY_LABELS.archivedSection}{" "}
          <span className="font-normal text-muted-foreground">({count})</span>
        </span>
      </button>
      {open && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Archived items stay available for history. Restore one before using it on a new event or client.
          </p>
          {children}
        </div>
      )}
    </section>
  );
}
