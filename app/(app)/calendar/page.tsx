import type { Metadata } from "next";
import { Suspense } from "react";

import { CalendarPageClient } from "@/components/calendar/calendar-page-client";
import { NavListBodyFallback } from "@/components/shell/nav-list-body-fallback";
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

async function CalendarBodyIsland({ params }: { params: CalendarViewParams }) {
  const [
    { view, year, month, weekStart, dayDate, items, today },
    scheduleCatalog,
    venue,
    tourSettings,
    inquirySettings,
    spaces,
  ] = await Promise.all([
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

/**
 * Unified calendar — Month/Week/Day/Agenda views over the same underlying
 * getCalendarData() aggregation (Calendar Integration Phase 3).
 */
export default async function CalendarPage({ searchParams }: Props) {
  const params = await searchParams;

  // No sync PageHeader here — CalendarPageClient already owns the canonical banner.
  return (
    <div className="htc-hospitality-page space-y-4 sm:space-y-6" data-testid="calendar-streaming-root">
      <Suspense fallback={<NavListBodyFallback label="Loading calendar" />}>
        <CalendarBodyIsland params={params} />
      </Suspense>
    </div>
  );
}
