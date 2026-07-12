"use client";

/**
 * Booking Schedule — Calendar Integration Phase 3, extended Phase 4.
 *
 * Calendar's booking-specific lens: one wedding's entire dated footprint,
 * chronological, read-only. Not Timeline (day-of run-of-show) and not
 * Planning (task management) — it reveals both, alongside Requests,
 * Contracts, Payments, and Documents, without owning any of them. Every
 * item still links back to its true owning workspace.
 */
import * as React from "react";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { ItemRow } from "@/components/calendar/calendar-shared";
import type { BookingScheduleData } from "@/lib/calendar/booking-schedule";

export function BookingScheduleView({ data }: { data: BookingScheduleData }) {
  const byDate = React.useMemo(() => {
    const map = new Map<string, typeof data.items>();
    for (const item of data.items) {
      const existing = map.get(item.date) ?? [];
      map.set(item.date, [...existing, item]);
    }
    return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  }, [data]);

  // Operational cue (Phase 4) — deliberately NOT a Readiness recomputation:
  // Readiness's full score needs Guest/Seating/Conversation data this page
  // never fetches. This is a distinct, honestly cheaper signal: how many of
  // the items Calendar already has in hand for this booking are overdue.
  // "View full readiness" below links to the real one instead of
  // approximating it further.
  const overdueCount = data.items.filter((i) => i.subtitle === "Overdue").length;

  return (
    <div className="space-y-6">
      {/* Quick navigation between bookings (Phase 4) */}
      <div className="flex items-center justify-between gap-4">
        {data.previousBooking ? (
          <Link href={`/calendar/booking/${data.previousBooking.eventId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-4 w-4" /> {data.previousBooking.name}
          </Link>
        ) : <span />}
        {data.nextBooking ? (
          <Link href={`/calendar/booking/${data.nextBooking.eventId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            {data.nextBooking.name} <ChevronRight className="h-4 w-4" />
          </Link>
        ) : <span />}
      </div>

      <div>
        <h1 className="font-heading text-xl font-medium text-heading">
          {data.clientName ?? data.eventName} — Booking Schedule
        </h1>
        <p className="text-sm text-muted-foreground">
          Every dated item for this wedding, in one chronological list. Click anything to open it where it actually lives —
          this page never edits.
        </p>
        <div className="mt-2 flex items-center gap-3 text-xs">
          {overdueCount > 0 && (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive">
              {overdueCount} item{overdueCount !== 1 ? "s" : ""} overdue
            </span>
          )}
          <Link href={`/events/${data.eventId}#overview`} className="text-primary hover:underline">
            View full readiness →
          </Link>
        </div>
      </div>

      {byDate.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Nothing dated yet for this booking.</p>
      ) : (
        <div className="space-y-5">
          {byDate.map(([date, dateItems]) => {
            const [y, m, d] = date.split("-").map(Number);
            const label = new Date(y, m - 1, d).toLocaleDateString("en-US", {
              weekday: "long", month: "long", day: "numeric", year: "numeric",
            });
            const isWeddingDay = date === data.eventDate;
            return (
              <div key={date} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {label}{isWeddingDay ? " — Wedding Day" : ""}
                </p>
                <div className="space-y-2">
                  {dateItems.map((item) => <ItemRow key={item.id} item={item} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data.gaps.length > 0 && (
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Not yet part of this schedule</p>
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {data.gaps.map((gap) => <li key={gap}>{gap}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
