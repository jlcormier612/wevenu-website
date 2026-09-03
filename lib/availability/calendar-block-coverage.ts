/**
 * Calendar-block coverage — a separate booking constraint from Event occupancy.
 *
 * Occupancy/capacity/turnaround stay in event-occupancy.ts and
 * assert_event_availability. This module answers a different question:
 * does a calendar_blocks row (including recurrence) cover this venue-local
 * date/time interval?
 *
 * Recurrence rules are the same expansion Calendar display already uses
 * (lib/calendar/recurrence.ts). Dates and clock times on calendar_blocks
 * are venue-local wall-clock values; occurrence arithmetic is calendar-date
 * arithmetic on those dates, not UTC wall-clock.
 *
 * Postgres covering_calendar_block_title is write-path authority. This
 * TypeScript module is the precheck / Book This Lead / Direct Add mirror.
 */

import {
  addClockMinutes,
  normalizeClock,
  operationalWindow,
  protectedEndDate,
  windowsOverlap,
} from "@/lib/availability/event-occupancy";
import type { RecurrenceRule } from "@/lib/availability/types";
import {
  durationInDays,
  expandOccurrenceStarts,
  type RecurrenceSpec,
} from "@/lib/calendar/recurrence";

export const TOUR_CLOSING_CALENDAR_BLOCK_TYPES = [
  "blocked_time",
  "wedding_event_booking",
  "private_event",
] as const;

const ALL_DAY_START = "00:00";
const ALL_DAY_END = "23:59";

export type CoverageInterval = {
  rangeStart: string;
  rangeEnd: string;
  windowStart: string;
  windowEnd: string;
};

export type CalendarBlockCoverageInput = {
  title: string;
  type: string;
  startDate?: string | null;
  endDate?: string | null;
  isAllDay?: boolean | null;
  startTime?: string | null;
  endTime?: string | null;
  recurrenceRule?: RecurrenceRule | string | null;
  recurrenceInterval?: number | null;
  recurrenceEndsOn?: string | null;
  recurrenceCount?: number | null;
};

export type CalendarBlockCoverage = {
  title: string;
  type: string;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  startTime: string | null;
  endTime: string | null;
  recurrenceRule: RecurrenceRule;
  recurrenceInterval: number;
  recurrenceEndsOn: string | null;
  recurrenceCount: number | null;
};

export type EventCoverageInput = {
  eventDate: string;
  eventEndDate?: string | null;
  setupTime?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  teardownTime?: string | null;
};

export function eventCoverageInterval(input: EventCoverageInput): CoverageInterval {
  const win = operationalWindow(input);
  return {
    rangeStart: input.eventDate,
    rangeEnd: protectedEndDate(input.eventDate, input.eventEndDate),
    windowStart: win.start,
    windowEnd: win.end,
  };
}

export function tourCoverageInterval(input: {
  date: string;
  startTime?: string | null;
  durationMinutes?: number | null;
}): CoverageInterval {
  const start = normalizeClock(input.startTime);
  if (!start) {
    return {
      rangeStart: input.date,
      rangeEnd: input.date,
      windowStart: ALL_DAY_START,
      windowEnd: ALL_DAY_END,
    };
  }
  const duration = input.durationMinutes && input.durationMinutes > 0
    ? input.durationMinutes
    : 60;
  const added = addClockMinutes(start, duration);
  return {
    rangeStart: input.date,
    rangeEnd: input.date,
    windowStart: start,
    windowEnd: added.dayOffset > 0 ? "24:00" : added.clock,
  };
}

export function inquiryDateCoverageInterval(date: string): CoverageInterval {
  return {
    rangeStart: date,
    rangeEnd: date,
    windowStart: ALL_DAY_START,
    windowEnd: ALL_DAY_END,
  };
}

export function blockClockWindow(block: CalendarBlockCoverage): { start: string; end: string } {
  if (block.isAllDay || !block.startTime || !block.endTime) {
    return { start: ALL_DAY_START, end: ALL_DAY_END };
  }
  const start = normalizeClock(block.startTime) || ALL_DAY_START;
  const end = normalizeClock(block.endTime) || ALL_DAY_END;
  return { start, end };
}

function asRecurrenceRule(value: string | null | undefined): RecurrenceRule {
  if (value === "daily" || value === "weekly" || value === "monthly" || value === "annual") {
    return value;
  }
  return "none";
}

export function normalizeCalendarBlockCoverage(
  block: CalendarBlockCoverageInput,
  fallbackDate: string,
): CalendarBlockCoverage {
  const startDate = block.startDate || fallbackDate;
  const hasTimes = !!(block.startTime && block.endTime);
  return {
    title: block.title,
    type: block.type,
    startDate,
    endDate: block.endDate || startDate,
    isAllDay: block.isAllDay ?? !hasTimes,
    startTime: block.startTime ?? null,
    endTime: block.endTime ?? null,
    recurrenceRule: asRecurrenceRule(block.recurrenceRule),
    recurrenceInterval: block.recurrenceInterval ?? 1,
    recurrenceEndsOn: block.recurrenceEndsOn ?? null,
    recurrenceCount: block.recurrenceCount ?? null,
  };
}

export function mapCalendarBlockRow(row: {
  title: string;
  type: string;
  start_date: string;
  end_date: string;
  is_all_day?: boolean | null;
  start_time?: string | null;
  end_time?: string | null;
  recurrence_rule?: string | null;
  recurrence_interval?: number | null;
  recurrence_ends_on?: string | null;
  recurrence_count?: number | null;
}): CalendarBlockCoverage {
  return normalizeCalendarBlockCoverage(
    {
      title: row.title,
      type: row.type,
      startDate: row.start_date,
      endDate: row.end_date,
      isAllDay: row.is_all_day,
      startTime: row.start_time?.slice(0, 5) ?? null,
      endTime: row.end_time?.slice(0, 5) ?? null,
      recurrenceRule: row.recurrence_rule,
      recurrenceInterval: row.recurrence_interval,
      recurrenceEndsOn: row.recurrence_ends_on,
      recurrenceCount: row.recurrence_count,
    },
    row.start_date,
  );
}

function recurrenceSpec(block: CalendarBlockCoverage): RecurrenceSpec {
  return {
    rule: block.recurrenceRule,
    interval: block.recurrenceInterval,
    endsOn: block.recurrenceEndsOn,
    count: block.recurrenceCount,
  };
}

export function calendarBlockCoversInterval(
  block: CalendarBlockCoverageInput,
  interval: CoverageInterval,
): boolean {
  const normalized = normalizeCalendarBlockCoverage(block, interval.rangeStart);
  if (!windowsOverlap(blockClockWindow(normalized), {
    start: interval.windowStart,
    end: interval.windowEnd,
  })) {
    return false;
  }
  const duration = durationInDays(normalized.startDate, normalized.endDate);
  const starts = expandOccurrenceStarts(
    normalized.startDate,
    recurrenceSpec(normalized),
    interval.rangeStart,
    interval.rangeEnd,
    duration,
  );
  return starts.length > 0;
}

export function coveringCalendarBlockTitle(
  blocks: CalendarBlockCoverageInput[],
  interval: CoverageInterval,
  opts?: { types?: readonly string[] | null },
): string | null {
  const allowed = opts?.types ?? null;
  for (const block of blocks) {
    if (allowed && !allowed.includes(block.type)) continue;
    if (calendarBlockCoversInterval(block, interval)) return block.title;
  }
  return null;
}
