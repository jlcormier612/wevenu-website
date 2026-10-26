"use client";

/** Timeline summary — item count, Last Updated, and couple release status. */

import { History, List, Share2 } from "lucide-react";

import { formatRelative } from "@/lib/leads/constants";
import type { VenueTimelineClientShareStatus } from "@/lib/timeline/audience-ownership";

export type TimelineReleaseStatusHint = {
  hasPriorRelease: boolean;
  lastReleasedAt: string | null;
  workingAheadOfRelease?: boolean;
};

function shareStatusLabel(
  status: VenueTimelineClientShareStatus | null | undefined,
  release?: TimelineReleaseStatusHint | null,
): string | null {
  if (release) {
    if (!release.hasPriorRelease) return "Not on the couple's shared timeline yet";
    const when = release.lastReleasedAt ? ` · ${formatRelative(release.lastReleasedAt)}` : "";
    if (release.workingAheadOfRelease) {
      return `Shared with the couple${when} · working changes not shared yet`;
    }
    return `Shared with the couple${when}`;
  }
  if (!status || status.kind === "empty") return null;
  if (status.kind === "shared") return "Shared with couple";
  if (status.kind === "partial") {
    return `${status.sharedCount} of ${status.venueOwnedCount} items shared with couple`;
  }
  return "Not yet shared with couple";
}

export function TimelineSummaryBar({
  itemCount, lastUpdated = null, clientShareStatus = null, releaseStatus = null,
}: {
  itemCount: number;
  lastUpdated?: string | null;
  clientShareStatus?: VenueTimelineClientShareStatus | null;
  releaseStatus?: TimelineReleaseStatusHint | null;
}) {
  const shareLabel = shareStatusLabel(clientShareStatus, releaseStatus);
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
