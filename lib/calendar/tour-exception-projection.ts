/**
 * Read-only calendar projection of tour_availability_exceptions.
 *
 * Those rows stay the source of truth for tour closures (and, via
 * _is_event_date_available, public inquiry closures). Calendar does not
 * copy them into calendar_blocks. Dates are inclusive `date` values, expanded
 * with the same UTC calendar arithmetic as recurrence.ts so a venue-local
 * date does not move when the server timezone changes.
 *
 * Annual rules expand into the requested month with the same engine as
 * calendar_blocks so December 25 appears every year while the rule is active.
 */
import type { CalendarItem } from "@/lib/calendar/types";
import {
  durationInDays,
  expandOccurrenceStarts,
  occurrenceDates,
} from "@/lib/calendar/recurrence";
import { venueCalendarTaxonomyKey } from "@/lib/calendar/venue-calendar-scope";
import { normalizeTourBlockedRecurrence } from "@/lib/tours/blocked-date-recurrence";

export type TourAvailabilityExceptionRow = {
  id: string;
  start_date: string;
  end_date: string;
  label: string | null;
  recurrence_rule?: string | null;
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
    const rule = normalizeTourBlockedRecurrence(row.recurrence_rule);
    const duration = durationInDays(start, end);
    const occurrenceStarts =
      rule === "none"
        ? start <= input.rangeEnd && end >= input.rangeStart
          ? [start]
          : []
        : expandOccurrenceStarts(
            start,
            { rule: "annual", interval: 1, endsOn: null, count: null },
            input.rangeStart,
            input.rangeEnd,
            duration,
          );
    const label = row.label?.trim() || "Blocked Time";
    for (const occStart of occurrenceStarts) {
      for (const date of occurrenceDates(occStart, duration)) {
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
  }
  return items;
}
