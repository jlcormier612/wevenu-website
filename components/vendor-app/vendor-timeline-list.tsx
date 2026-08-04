"use client";

import Link from "next/link";
import { Clock } from "lucide-react";

import { formatTime } from "@/lib/vendors/constants";
import { formatEventDateRange } from "@/lib/events/constants";
import type { VendorTimelineByEvent } from "@/lib/vendor-portal/types";

/** Vendor Workspace Realignment, Phase 7 — vendor-visible timeline entries across every booked event, grouped by event. */
export function VendorTimelineList({ eventsWithTimeline }: { eventsWithTimeline: VendorTimelineByEvent[] }) {
  const withEntries = eventsWithTimeline.filter((e) => e.entries.length > 0);

  if (withEntries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center">
        <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">No run-of-show items yet</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
          Your venue shares day-of timing with vendors when they are ready.
          Nothing is missing on your side until they do.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {withEntries.map((ev) => (
        <div key={ev.eventId} className="space-y-2">
          <div className="flex items-baseline justify-between">
            <Link href={`/vendor/events/${ev.assignmentId}`} className="text-sm font-semibold text-foreground hover:text-primary">
              {ev.eventName}
            </Link>
            <span className="text-xs text-muted-foreground">
              {ev.venueName}
              {ev.eventDate ? ` · ${formatEventDateRange(ev.eventDate, ev.eventEndDate)}` : ""}
            </span>
          </div>
          <div className="space-y-2">
            {ev.entries.map((entry) => (
              <div key={entry.id} className="flex gap-4 rounded-xl border border-border bg-card px-4 py-3">
                <div className="w-16 shrink-0 text-xs font-medium text-muted-foreground pt-0.5">
                  {entry.time ? formatTime(entry.time) : "—"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{entry.title}</p>
                  {entry.description && <p className="text-xs text-muted-foreground mt-0.5">{entry.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
