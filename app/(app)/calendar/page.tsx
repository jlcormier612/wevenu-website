import type { Metadata } from "next";
import Link from "next/link";
import { Printer } from "lucide-react";

import { ShareAvailability } from "@/components/calendar/share-availability";
import { ShareTourAvailability } from "@/components/calendar/share-tour-availability";
import { CalendarView } from "@/components/calendar/calendar-view";
import { PageHeader } from "@/components/shell/module-placeholder";
import { getScheduleItemTypesForPicker } from "@/lib/calendar/schedule-item-catalog-service";
import { resolveCalendarView, type CalendarViewParams } from "@/lib/calendar/view-data";
import { publicAppOrigin } from "@/lib/env";
import { publicTourSchedulingPath } from "@/lib/tours/public-link";
import { getTourSettings } from "@/lib/tours/service";
import { getCurrentVenue } from "@/lib/venue/service";

export const metadata: Metadata = { title: "Calendar" };

type Props = { searchParams: Promise<CalendarViewParams> };

/**
 * Unified calendar — Month/Week/Day/Agenda views over the same underlying
 * getCalendarData() aggregation (Calendar Integration Phase 3). Month
 * navigation and the new view-specific navigation (weekStart/date) all use
 * URL search params so every view is server-rendered with fresh data.
 * Window resolution (including the month-boundary merge for Week/Agenda)
 * lives in lib/calendar/view-data.ts, shared with the print page.
 */
export default async function CalendarPage({ searchParams }: Props) {
  const params = await searchParams;
  const [{ view, year, month, weekStart, dayDate, items, today }, scheduleCatalog, venue, tourSettings] = await Promise.all([
    resolveCalendarView(params),
    getScheduleItemTypesForPicker(),
    getCurrentVenue(),
    getTourSettings(),
  ]);

  const printHref = `/calendar/print?view=${view}&year=${year}&month=${month}&weekStart=${weekStart}&date=${dayDate}`;
  const availabilityUrl = venue?.embedKey
    ? `${publicAppOrigin()}/availability/${venue.embedKey}`
    : null;
  const tourPath = tourSettings?.tourSchedulingEnabled
    ? publicTourSchedulingPath(tourSettings.tourEmbedKey)
    : null;
  const tourUrl = tourPath ? `${publicAppOrigin()}${tourPath}` : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Calendar"
          description="Your venue’s schedule — events, appointments, holds, and blocked time."
        />
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Link
            href={printHref}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" /> Print / Export
          </Link>
        </div>
      </div>
      <div className="grid items-stretch gap-3 md:grid-cols-2">
        {availabilityUrl ? <ShareAvailability url={availabilityUrl} /> : null}
        <ShareTourAvailability url={tourUrl} />
      </div>
      <p className="text-sm text-muted-foreground">
        Availability is venue-controlled. Only Holds and Booked events protect dates. Inquiry dates and preferred dates do not reserve a date.{" "}
        <Link href="/help/how-does-date-availability-work" className="font-medium text-foreground underline underline-offset-4">
          Learn how availability works
        </Link>
      </p>
      <CalendarView
        view={view}
        year={year}
        month={month}
        weekStart={weekStart}
        dayDate={dayDate}
        items={items}
        today={today}
        scheduleCatalog={scheduleCatalog}
      />
    </div>
  );
}
