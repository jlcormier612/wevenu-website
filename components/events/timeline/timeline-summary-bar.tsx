"use client";

/** Timeline summary — item count, Last Updated, and couple-share status. */

import { History, List, Share2 } from "lucide-react";

import { formatRelative } from "@/lib/leads/constants";
import type { VenueTimelineClientShareStatus } from "@/lib/timeline/audience-ownership";

function shareStatusLabel(status: VenueTimelineClientShareStatus | null | undefined): string | null {
  if (!status || status.kind === "empty") return null;
  if (status.kind === "shared") return "Shared with couple";
  if (status.kind === "partial") {
    return `${status.sharedCount} of ${status.venueOwnedCount} items shared with couple`;
  }
  return "Not yet shared with couple";
}

export function TimelineSummaryBar({
  itemCount, lastUpdated = null, clientShareStatus = null,
}: {
  itemCount: number;
  lastUpdated?: string | null;
  clientShareStatus?: VenueTimelineClientShareStatus | null;
}) {
  const shareLabel = shareStatusLabel(clientShareStatus);
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
      {shareLabel && (
        <div className="flex items-center gap-1.5 text-sm">
          <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Couple</span>
          <span className="font-medium text-foreground">{shareLabel}</span>
        </div>
      )}
    </div>
  );
}
