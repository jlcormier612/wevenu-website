/**
 * Venue-facing booking summary: multi-day component schedule from persisted
 * event_space_assignments (dates, times, spaces) — never invent times from
 * another component or treat event.start/end as every day's hours.
 */

import { formatTime } from "@/lib/events/constants";
import { labelForUseKey } from "@/lib/venue-spaces/uses";

export type BookingSummaryComponent = {
  useKey: string;
  useLabel: string;
  spaceName: string | null;
  scheduledDate: string | null;
  startTime: string | null;
  endTime: string | null;
  sortOrder?: number;
};

export type BookingSummaryDayGroup = {
  /** YYYY-MM-DD, or null when the component has no saved date. */
  date: string | null;
  label: string;
  components: BookingSummaryComponent[];
};

function formatDayLabel(isoDate: string): string {
  return new Date(isoDate + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Human time range for one component; honest when unset. */
export function formatComponentTimeRange(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): string {
  const start = startTime?.trim() || "";
  const end = endTime?.trim() || "";
  if (!start && !end) return "Time not set";
  if (start && end) return `${formatTime(start)} – ${formatTime(end)}`;
  if (start) return formatTime(start);
  return `Until ${formatTime(end)}`;
}

/**
 * Group components by saved scheduled_date. Components without a date form
 * their own "Date not set" group — we do not copy the primary event date.
 */
export function groupBookingSummaryByDate(
  components: readonly BookingSummaryComponent[],
): BookingSummaryDayGroup[] {
  const sorted = [...components].sort((a, b) => {
    const da = a.scheduledDate ?? "9999-12-31";
    const db = b.scheduledDate ?? "9999-12-31";
    if (da !== db) return da.localeCompare(db);
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });
  const groups = new Map<string, BookingSummaryComponent[]>();
  for (const c of sorted) {
    const key = c.scheduledDate ?? "";
    const list = groups.get(key) ?? [];
    list.push(c);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([key, comps]) => ({
    date: key || null,
    label: key ? formatDayLabel(key) : "Date not set",
    components: comps,
  }));
}

export function componentDisplayLabel(c: BookingSummaryComponent): string {
  return labelForUseKey(c.useKey, c.useLabel);
}
