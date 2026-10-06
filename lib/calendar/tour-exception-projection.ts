/**
 * Read-only calendar projection of tour_availability_exceptions.
 *
 * Those rows stay the source of truth for tour closures. Calendar does not
 * copy them into calendar_blocks. Dates are inclusive `date` values, expanded
 * with the same UTC calendar arithmetic as recurrence.ts so a venue-local
 * date does not move when the server timezone changes.
 */
import type { CalendarItem } from "@/lib/calendar/types";
import { durationInDays, occurrenceDates } from "@/lib/calendar/recurrence";
import { venueCalendarTaxonomyKey } from "@/lib/calendar/venue-calendar-scope";

export type TourAvailabilityExceptionRow = {
  id: string;
  start_date: string;
  end_date: string;
  label: string | null;
};

/** Dates that already show Blocked Time from a real calendar_blocks row. */
export function blockedTimeDates(
  items: { date: string; type: CalendarItem["type"]; manualType?: CalendarItem["manualType"] }[],
): Set<string> {
  const dates = new Set<string>();
  for (const item of items) {
    if (venueCalendarTaxonomyKey(item) === "blocked_time") dates.add(item.date);
  }
  return dates;
}

/**
 * Project exceptions that overlap [rangeStart, rangeEnd] into all-day
 * Blocked Time items. A date already occupied by a real Blocked Time row
 * is skipped so the two sources do not paint the same legend entry twice.
 * Existing items are not removed or rewritten.
 */
export function projectTourAvailabilityExceptions(input: {
  exceptions: TourAvailabilityExceptionRow[];
  rangeStart: string;
  rangeEnd: string;
  occupiedBlockedDates: ReadonlySet<string>;
}): CalendarItem[] {
  const items: CalendarItem[] = [];
  for (const row of input.exceptions) {
    const start = row.start_date.slice(0, 10);
    const end = row.end_date.slice(0, 10);
    if (!start || !end || end < start) continue;
    if (start > input.rangeEnd || end < input.rangeStart) continue;
    const label = row.label?.trim() || "Blocked Time";
    for (const date of occurrenceDates(start, durationInDays(start, end))) {
      if (date < input.rangeStart || date > input.rangeEnd) continue;
      if (input.occupiedBlockedDates.has(date)) continue;
      items.push({
        id: `tour-exception-${row.id}-${date}`,
        type: "calendar_block",
        date,
        title: label,
        subtitle: null,
        time: null,
        endTime: null,
        link: "/settings/availability",
        manualType: "blocked_time",
      });
    }
  }
  return items;
}
