"use client";

/**
 * Booking Schedule — Calendar Integration Phase 3.
 *
 * Calendar's booking-specific lens: one wedding's entire dated footprint,
 * chronological, read-only. Not Timeline (day-of run-of-show) and not
 * Planning (task management) — it reveals both, alongside Requests,
 * Contracts, Payments, and Documents, without owning any of them. Every
 * item still links back to its true owning workspace.
 */
import * as React from "react";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-medium text-heading">
          {data.clientName ?? data.eventName} — Booking Schedule
        </h1>
        <p className="text-sm text-muted-foreground">
          Every dated item for this wedding, in one chronological list. Click anything to open it where it actually lives —
          this page never edits.
        </p>
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
