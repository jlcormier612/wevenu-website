"use client";

/** Timeline summary — Event Start, Event End, item count, Last Updated. No analytics. */

import { Clock, History, ListChecks } from "lucide-react";

import { formatRelative } from "@/lib/leads/constants";
import { formatTime } from "@/lib/timeline/constants";

export function TimelineSummaryBar({
  eventStartTime, eventEndTime, itemCount, lastUpdated = null,
}: {
  eventStartTime: string | null;
  eventEndTime: string | null;
  itemCount: number;
  lastUpdated?: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 rounded-xl border border-border bg-muted/20 px-4 py-2.5">
      <div className="flex items-center gap-1.5 text-sm">
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">Event Start</span>
        <span className="font-medium text-foreground">{eventStartTime ? formatTime(eventStartTime) : "Not set"}</span>
      </div>
      <div className="flex items-center gap-1.5 text-sm">
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">Event End</span>
        <span className="font-medium text-foreground">{eventEndTime ? formatTime(eventEndTime) : "Not set"}</span>
      </div>
      <div className="flex items-center gap-1.5 text-sm">
        <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
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
