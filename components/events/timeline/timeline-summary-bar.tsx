"use client";

/** Timeline summary — item count and Last Updated. */

import { History, List } from "lucide-react";

import { formatRelative } from "@/lib/leads/constants";

export function TimelineSummaryBar({
  itemCount, lastUpdated = null,
}: {
  itemCount: number;
  lastUpdated?: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 rounded-sm border border-border bg-muted/20 px-4 py-2.5">
      <div className="flex items-center gap-1.5 text-sm">
        <List className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">Timeline Items</span>
        <span className="font-medium text-foreground">{itemCount}</span>
      </div>
      <div className="flex items-center gap-1.5 text-sm">
        <History className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">Last Updated</span>
        <span className="font-medium text-foreground">{lastUpdated ? formatRelative(lastUpdated) : "Never"}</span>
      </div>
    </div>
  );
}
