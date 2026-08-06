/**
 * Legacy CRM-style vendor dashboard — orphaned by Vendor Workspace
 * Realignment (Home is VendorHome). Kept so old imports don't explode;
 * not routed. Do not wire Business Health / inquiry CRM back in.
 */
"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";

import type { VendorDashboardData, VendorDashboardEvent } from "@/lib/vendors/types";
import { formatEventDateRangeShort } from "@/lib/events/constants";
import { formatTime } from "@/lib/vendors/constants";

function EventRow({ ev }: { ev: VendorDashboardEvent }) {
  return (
    <Link
      href="/vendor/events"
      className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{ev.eventName}</p>
        <p className="text-xs text-muted-foreground">{ev.venueName}</p>
      </div>
      <div className="text-right shrink-0 space-y-0.5">
        {ev.eventDate && (
          <p className="text-xs font-medium text-foreground">
            {formatEventDateRangeShort(ev.eventDate, ev.eventEndDate)}
          </p>
        )}
        {ev.arrivalTime && (
          <p className="text-xs text-muted-foreground">Arrival {formatTime(ev.arrivalTime)}</p>
        )}
      </div>
    </Link>
  );
}

export function VendorDashboard({ data }: { data: VendorDashboardData }) {
  const upcoming = data.upcomingEvents;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{data.vendor.businessName}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Legacy dashboard — use Home and Luv for daily attention.
        </p>
      </div>
      <div className="rounded-sm border border-border bg-card divide-y divide-border">
        {upcoming.length === 0 ? (
          <div className="py-10 text-center">
            <CalendarDays className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No upcoming events</p>
          </div>
        ) : (
          upcoming.slice(0, 5).map((ev) => <EventRow key={ev.id} ev={ev} />)
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        <Link href="/vendor/luv" className="text-primary hover:underline">Open Luv&apos;s briefing →</Link>
      </p>
    </div>
  );
}
