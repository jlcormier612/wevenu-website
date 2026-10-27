/**
 * Day-of Sheet schedule projection from the event's persisted Timeline.
 * Source of truth: current saved event Timeline entries (not Library templates).
 *
 * Timed entries → chronological Schedule (compareTimelineEntries).
 * Untimed entries → separate Unscheduled items list (no fabricated times).
 *
 * Venue control (locked product decision): the day-of sheet is an operational
 * venue document. Only venue-owned Timeline entries are eligible. Client-
 * submitted rows remain on the shared Timeline (merged view / Timeline print)
 * but are not auto-included here. The venue includes an item by keeping or
 * adding a venue-owned entry on the Timeline tab — without converting the
 * couple's own row.
 */

import {
  addDaysToIsoDate,
  compareTimelineEntries,
  formatTimelineDayHeader,
} from "@/lib/timeline/constants";
import type { TimelineEntry } from "@/lib/timeline/types";

/** Venue-owned rows only — client-submitted collaboration stays off the sheet. */
export function selectDaySheetTimelineEntries(entries: TimelineEntry[]): TimelineEntry[] {
  return entries.filter((e) => e.owner === "venue");
}

export type DaySheetScheduleGroup = {
  dayOffset: number;
  /** Null when all timed rows share day 0 and the event is single-day. */
  dayLabel: string | null;
  entries: TimelineEntry[];
};

export type DaySheetSchedule = {
  timedGroups: DaySheetScheduleGroup[];
  unscheduled: TimelineEntry[];
};

/** Normalize RPC/DB time ("14:00:00" or "14:00") to HH:MM, or "" if absent. */
export function normalizeDaySheetEntryTime(raw: string | null | undefined): string {
  if (raw == null) return "";
  const s = String(raw).trim();
  if (!s) return "";
  // Postgres time / timestamptz fragments → HH:MM
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return "";
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || h < 0 || h > 23 || !Number.isFinite(min) || min < 0 || min > 59) {
    return "";
  }
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function buildDaySheetSchedule(
  entries: TimelineEntry[],
  eventDate: string,
  eventEndDate?: string | null,
): DaySheetSchedule {
  const venueOwned = selectDaySheetTimelineEntries(entries);
  const normalized = venueOwned.map((e) => ({
    ...e,
    entryTime: normalizeDaySheetEntryTime(e.entryTime) || null,
  }));
  const sorted = [...normalized].sort(compareTimelineEntries);
  const timed = sorted.filter((e) => Boolean(e.entryTime));
  const unscheduled = sorted.filter((e) => !e.entryTime);

  const byDay = new Map<number, TimelineEntry[]>();
  for (const e of timed) {
    const d = e.dayOffset ?? 0;
    const list = byDay.get(d) ?? [];
    list.push(e);
    byDay.set(d, list);
  }

  const offsets = [...byDay.keys()].sort((a, b) => a - b);
  const multiDay =
    offsets.length > 1
    || offsets.some((o) => o > 0)
    || Boolean(eventEndDate && eventEndDate > eventDate);

  const timedGroups: DaySheetScheduleGroup[] = offsets.map((dayOffset) => ({
    dayOffset,
    dayLabel: multiDay
      ? (eventDate
        ? formatTimelineDayHeader(eventDate, dayOffset)
        : `Day ${dayOffset + 1}`)
      : null,
    entries: byDay.get(dayOffset) ?? [],
  }));

  return { timedGroups, unscheduled };
}

/** Absolute calendar date for a day-offset row (for tests / headers). */
export function daySheetEntryDate(eventDate: string, dayOffset: number): string {
  return addDaysToIsoDate(eventDate, dayOffset);
}
