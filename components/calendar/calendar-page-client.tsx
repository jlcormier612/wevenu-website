"use client";

/**
 * Calendar page shell — owns the canonical PageHeader primary action
 * (green Add Schedule Item) so it is not visually subordinate to Print.
 */

import * as React from "react";

import Link from "next/link";
import { Plus, Printer } from "lucide-react";

import { CalendarView, type CalendarViewHandle } from "@/components/calendar/calendar-view";
import { ShareAvailability } from "@/components/calendar/share-availability";
import { ShareTourAvailability } from "@/components/calendar/share-tour-availability";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import type { VenueScheduleItemType } from "@/lib/calendar/schedule-item-catalog";
import type { CalendarItem } from "@/lib/calendar/types";
import type { VenueEventTypeOption } from "@/lib/event-types/venue-options";

export function CalendarPageClient({
  view,
  year,
  month,
  weekStart,
  dayDate,
  items,
  today,
  scheduleCatalog,
  bookingEventTypeOptions,
  spaceOperatingMode,
  venueSpaces,
  printHref,
  availabilityUrl,
  tourUrl,
}: {
  view: "month" | "week" | "day" | "agenda";
  year: number;
  month: number;
  weekStart: string;
  dayDate: string;
  items: CalendarItem[];
  today: string;
  scheduleCatalog: VenueScheduleItemType[];
  bookingEventTypeOptions: VenueEventTypeOption[];
  spaceOperatingMode: "single" | "multi";
  venueSpaces: Array<{ id: string; name: string; isActive: boolean }>;
  printHref: string;
  availabilityUrl: string | null;
  tourUrl: string | null;
}) {
  const calendarRef = React.useRef<CalendarViewHandle>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="Your venue’s schedule — events, appointments, holds, and blocked time."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={() => calendarRef.current?.toggleScheduleForm()}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add Schedule Item
            </Button>
            <Button
              type="button"
              variant="outline"
              render={<Link href={printHref} target="_blank" />}
            >
              <Printer className="mr-1 h-3.5 w-3.5" /> Print / Export
            </Button>
          </div>
        }
      />
      <div className="grid items-stretch gap-3 md:grid-cols-2">
        {availabilityUrl ? <ShareAvailability url={availabilityUrl} /> : null}
        <ShareTourAvailability url={tourUrl} />
      </div>
      <p className="text-sm text-muted-foreground">
        Availability is venue-controlled. Only Holds, Booked Events and Blocked Time protect dates. Inquiry dates and preferred dates do not reserve a date.{" "}
        <Link href="/help/how-does-date-availability-work" className="font-medium text-foreground underline underline-offset-4">
          Learn how availability works
        </Link>
      </p>
      <CalendarView
        ref={calendarRef}
        view={view}
        year={year}
        month={month}
        weekStart={weekStart}
        dayDate={dayDate}
        items={items}
        today={today}
        scheduleCatalog={scheduleCatalog}
        bookingEventTypeOptions={bookingEventTypeOptions}
        spaceOperatingMode={spaceOperatingMode}
        venueSpaces={venueSpaces}
        hideToolbarCreate
      />
    </div>
  );
}
