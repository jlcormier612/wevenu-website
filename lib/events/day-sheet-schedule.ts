/**
 * Day-of Sheet schedule projection from the event's persisted Timeline.
 * Source of truth: current saved event Timeline entries (not Library templates).
 *
 * Timed entries → chronological Schedule (compareTimelineEntries).
 * Untimed entries → separate Unscheduled items list (no fabricated times).
 */

import {
  addDaysToIsoDate,
  compareTimelineEntries,
  formatTimelineDayHeader,
} from "@/lib/timeline/constants";
import type { TimelineEntry } from "@/lib/timeline/types";

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

export function buildDaySheetSchedule(
  entries: TimelineEntry[],
  eventDate: string,
  eventEndDate?: string | null,
): DaySheetSchedule {
  const sorted = [...entries].sort(compareTimelineEntries);
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
