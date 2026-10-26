/**
 * Plain-language timeline timing helpers shared by template + event editors.
 * Relative minutes always mean Day-of schedule start (events.start_time) —
 * see docs/qa/timeline-timing-simplification/TIMING-CONTRACT.md.
 */

import { formatTime, resolveEntryTimeFromOffset } from "@/lib/timeline/constants";

/** Sole supported named relative anchor (matches apply.ts). */
export const DAY_OF_SCHEDULE_START_LABEL = "Day-of schedule start";

export type TimingMode = "specific" | "relative" | "untimed";

export function timingModeFromTemplateFields(
  timeOfDay: string | null | undefined,
  minutesOffset: number | null | undefined,
): TimingMode {
  const hasTime = Boolean(timeOfDay && String(timeOfDay).trim());
  const hasOffset = minutesOffset !== null && minutesOffset !== undefined;
  if (hasTime && hasOffset) return "specific"; // apply prefers clock; UI should warn
  if (hasTime) return "specific";
  if (hasOffset) return "relative";
  return "untimed";
}

export function templateHasConflictingTiming(
  timeOfDay: string | null | undefined,
  minutesOffset: number | null | undefined,
): boolean {
  const hasTime = Boolean(timeOfDay && String(timeOfDay).trim());
  const hasOffset = minutesOffset !== null && minutesOffset !== undefined;
  return hasTime && hasOffset;
}

export type TimelineDayAnchor = "event_start" | "event_end";

/** Template day label with explicit anchor (signed offsets supported). */
export function formatTemplateDayLabelClear(
  dayOffset: number,
  anchor: TimelineDayAnchor = "event_start",
): string {
  const n = Math.trunc(dayOffset);
  const anchorPhrase = anchor === "event_end" ? "event end" : "event start";
  if (n === 0) {
    return anchor === "event_end"
      ? "On the event’s last day"
      : "Day 1 — event start date";
  }
  const abs = Math.abs(n);
  const unit = abs === 1 ? "day" : "days";
  if (n < 0) return `${abs} ${unit} before ${anchorPhrase}`;
  return `${abs} ${unit} after ${anchorPhrase}`;
}

/**
 * Resolve template day rule to an event_date-relative offset.
 * Returns null when an end anchor cannot be resolved — never a start-relative substitute.
 * A same-day end date (end === start) is a valid span of 0. A missing end, or an end
 * before the start, is unresolved.
 */
export function resolveTemplateDayToEventOffset(
  dayOffset: number,
  anchor: TimelineDayAnchor,
  eventDate: string | null | undefined,
  eventEndDate: string | null | undefined,
): number | null {
  const n = Math.trunc(dayOffset);
  if (anchor !== "event_end") return n;
  if (!eventDate || !eventEndDate || eventEndDate < eventDate) return null;
  const start = new Date(`${eventDate}T12:00:00`);
  const end = new Date(`${eventEndDate}T12:00:00`);
  const span = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return span + n;
}

/**
 * Plain relative phrase. minutesOffset: negative = before, positive = after.
 */
export function formatRelativeToScheduleStart(minutesOffset: number): string {
  if (minutesOffset === 0) return `At ${DAY_OF_SCHEDULE_START_LABEL}`;
  const abs = Math.abs(minutesOffset);
  const unit = abs === 1 ? "minute" : "minutes";
  const dir = minutesOffset < 0 ? "before" : "after";
  return `${abs} ${unit} ${dir} ${DAY_OF_SCHEDULE_START_LABEL}`;
}

export function minutesFromRelativeForm(direction: "before" | "after" | "at", minutes: number): number {
  const m = Math.max(0, Math.trunc(Math.abs(minutes)));
  if (direction === "at") return 0;
  return direction === "before" ? -m : m;
}

export function relativeFormFromMinutes(minutesOffset: number): {
  direction: "before" | "after" | "at";
  minutes: number;
} {
  if (minutesOffset === 0) return { direction: "at", minutes: 0 };
  if (minutesOffset < 0) return { direction: "before", minutes: Math.abs(minutesOffset) };
  return { direction: "after", minutes: minutesOffset };
}

/** Preview clock when schedule start is known; null when missing (no invent). */
export function previewRelativeClock(
  minutesOffset: number,
  scheduleStart: string | null | undefined,
): { clock: string | null; label: string } {
  const phrase = formatRelativeToScheduleStart(minutesOffset);
  if (!scheduleStart) {
    return {
      clock: null,
      label: `${phrase}. Set Day-of schedule start on the event to calculate a clock time.`,
    };
  }
  const clock = resolveEntryTimeFromOffset(minutesOffset, scheduleStart);
  if (!clock) {
    return {
      clock: null,
      label: `${phrase}. That offset falls outside a single calendar day for start ${formatTime(scheduleStart)}.`,
    };
  }
  return {
    clock,
    label: `${phrase} → ${formatTime(clock)} (when start is ${formatTime(scheduleStart)})`,
  };
}

export function summarizeTemplateItemTiming(item: {
  timeOfDay?: string | null;
  minutesOffset?: number | null;
}): string | null {
  if (templateHasConflictingTiming(item.timeOfDay, item.minutesOffset)) {
    return `${item.timeOfDay} (also has relative — review)`;
  }
  if (item.timeOfDay) return formatTime(item.timeOfDay) || item.timeOfDay;
  if (item.minutesOffset !== null && item.minutesOffset !== undefined) {
    return formatRelativeToScheduleStart(item.minutesOffset);
  }
  return null;
}
