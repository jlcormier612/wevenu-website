"use client";

import { ChevronRight } from "lucide-react";

import type { OverviewException } from "@/lib/event-setup/state";

export function NeedsAttentionList({
  items,
  onOpen,
}: {
  items: OverviewException[];
  onOpen: (item: OverviewException) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="rounded-lg border border-border bg-card px-4 py-4">
      <h2 className="text-base font-medium text-heading">Needs attention</h2>
      <ul className="mt-2">
        {items.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              onClick={() => onOpen(item)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-muted/40"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
