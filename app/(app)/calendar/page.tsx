import type { Metadata } from "next";

import { CalendarPageClient } from "@/components/calendar/calendar-page-client";
import { getSpaces } from "@/lib/availability/service";
import { getScheduleItemTypesForPicker } from "@/lib/calendar/schedule-item-catalog-service";
import { resolveCalendarView, type CalendarViewParams } from "@/lib/calendar/view-data";
import { publicAppOrigin } from "@/lib/env";
import { buildVenueEventTypeOptions } from "@/lib/event-types/venue-options";
import { getInquiryFormSettings } from "@/lib/inquiry-form/service";
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
  const [{ view, year, month, weekStart, dayDate, items, today }, scheduleCatalog, venue, tourSettings, inquirySettings, spaces] = await Promise.all([
    resolveCalendarView(params),
    getScheduleItemTypesForPicker(),
    getCurrentVenue(),
    getTourSettings(),
    getInquiryFormSettings(),
    getSpaces(),
  ]);

  const printHref = `/calendar/print?view=${view}&year=${year}&month=${month}&weekStart=${weekStart}&date=${dayDate}`;
  const availabilityUrl = venue?.embedKey
    ? `${publicAppOrigin()}/availability/${venue.embedKey}`
    : null;
  const tourPath = tourSettings?.tourSchedulingEnabled
    ? publicTourSchedulingPath(tourSettings.tourEmbedKey)
    : null;
  const tourUrl = tourPath ? `${publicAppOrigin()}${tourPath}` : null;

  // Holds (booking placeholders) feed Convert-to-Lead — same accepted inquiry set.
  const bookingEventTypeOptions = buildVenueEventTypeOptions({
    acceptedRaw: inquirySettings?.acceptedEventTypes ?? null,
  });

  return (
    <CalendarPageClient
      view={view}
      year={year}
      month={month}
      weekStart={weekStart}
      dayDate={dayDate}
      items={items}
      today={today}
      scheduleCatalog={scheduleCatalog}
      bookingEventTypeOptions={bookingEventTypeOptions}
      spaceOperatingMode={venue?.spaceOperatingMode ?? "single"}
      venueSpaces={spaces.map((s) => ({ id: s.id, name: s.name, isActive: s.isActive }))}
      printHref={printHref}
      availabilityUrl={availabilityUrl}
      tourUrl={tourUrl}
    />
  );
}
