/**
 * Calendar is a VIEW of Events, not occupancy truth.
 * Expand a protected Event range onto the days the month actually shows.
 */
import { datesInProtectedRange } from "@/lib/availability/event-occupancy";

export function calendarDatesForProtectedEvent(
  eventDate: string,
  eventEndDate: string | null | undefined,
  rangeStart: string,
  rangeEnd: string,
): string[] {
  return datesInProtectedRange(eventDate, eventEndDate).filter(
    (d) => d >= rangeStart && d <= rangeEnd,
  );
}
