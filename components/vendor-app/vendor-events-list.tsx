"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatTime } from "@/lib/vendors/constants";
import type { VendorEventListItem } from "@/lib/vendors/types";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

export function VendorEventsList({ events }: { events: VendorEventListItem[] }) {
  const upcoming = events.filter((e) => e.isUpcoming);
  const past     = events.filter((e) => !e.isUpcoming);

  function renderRow(ev: VendorEventListItem) {
    return (
      <Link
        key={ev.assignmentId}
        href={`/vendor/events/${ev.assignmentId}`}
        className="flex items-center gap-4 px-4 py-3.5 hover:bg-muted/40 transition-colors"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{ev.eventName}</p>
          <p className="text-xs text-muted-foreground">{ev.venueName}</p>
        </div>
        <div className="shrink-0 text-right space-y-0.5">
          {ev.eventDate && (
            <p className="text-xs font-medium text-foreground">{formatDate(ev.eventDate)}</p>
          )}
          {ev.arrivalTime && (
            <p className="text-xs text-muted-foreground">Arrival {formatTime(ev.arrivalTime)}</p>
          )}
        </div>
        {ev.isUpcoming && (
          <Badge variant="default" className="shrink-0 text-xs">Upcoming</Badge>
        )}
      </Link>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-foreground">Events</h1>

      {events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-14 text-center">
          <CalendarDays className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No events yet</p>
          <p className="text-xs mt-1 text-muted-foreground max-w-xs mx-auto">
            Venues will assign you to events when they book you. Your event workspace will appear here.
          </p>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Upcoming</h2>
              <div className="rounded-xl border border-border bg-card divide-y divide-border">
                {upcoming.map(renderRow)}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Past</h2>
              <div className="rounded-xl border border-border bg-card divide-y divide-border">
                {past.map(renderRow)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
