/**
 * Tour Blocked Dates — annual recurrence helpers.
 * Date math matches lib/calendar/recurrence.ts (same engine calendar_blocks uses).
 */
import {
  describeRecurrence,
  durationInDays,
  expandOccurrenceStarts,
} from "@/lib/calendar/recurrence";

export type TourBlockedRecurrence = "none" | "annual";

export function normalizeTourBlockedRecurrence(value: unknown): TourBlockedRecurrence {
  return value === "annual" ? "annual" : "none";
}

export function tourExceptionCoversDate(
  exception: {
    startDate: string;
    endDate: string;
    recurrenceRule?: TourBlockedRecurrence | null;
  },
  date: string,
): boolean {
  const rule = normalizeTourBlockedRecurrence(exception.recurrenceRule);
  const duration = durationInDays(exception.startDate, exception.endDate);
  const starts = expandOccurrenceStarts(
    exception.startDate,
    { rule, interval: 1, endsOn: null, count: null },
    date,
    date,
    duration,
  );
  return starts.length > 0;
}

export function tourBlockedRecurrenceLabel(rule: TourBlockedRecurrence): string | null {
  if (rule === "none") return null;
  return describeRecurrence({ rule: "annual", interval: 1, endsOn: null, count: null });
}

/** Display date/range for the list — month + day when annual, full ISO when one-time. */
export function formatTourBlockedDateSpan(
  startDate: string,
  endDate: string,
  recurrenceRule: TourBlockedRecurrence,
): string {
  if (recurrenceRule !== "annual") {
    return startDate === endDate ? startDate : `${startDate} – ${endDate}`;
  }
  const startLabel = formatMonthDay(startDate);
  const endLabel = formatMonthDay(endDate);
  return startDate === endDate ? startLabel : `${startLabel} – ${endLabel}`;
}

function formatMonthDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
