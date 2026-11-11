/**
 * All-day vs timed Schedule Items.
 *
 * calendar_blocks.start_time / end_time are venue-local wall-clock `time`
 * values (HH:MM), not UTC timestamps. Display and persist must not convert
 * them through a Date in another zone — the venue timezone already decided
 * which calendar day the item sits on; the clock time is what the
 * coordinator typed.
 *
 * New/edit form defaults leave clock times empty. Inventing 09:00–17:00 made
 * short appointments look like full business days, and reopening an all-day
 * item then unchecking All day quietly wrote those fabricated times.
 */

/** Explicit boolean for calendar_blocks.is_all_day (DB default is true). */
export function normalizeScheduleItemAllDay(isAllDay: boolean | null | undefined): boolean {
  return isAllDay === true;
}

/**
 * Clock times for the Add/Edit form. Never invents a start/end — reopening
 * must show what was saved (or blank), not a business-day placeholder.
 */
export function formScheduleItemTimes(
  isAllDay: boolean,
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): { startTime: string; endTime: string } {
  if (isAllDay) return { startTime: "", endTime: "" };
  return {
    startTime: startTime?.slice(0, 5) ?? "",
    endTime: endTime?.slice(0, 5) ?? "",
  };
}

export function validateScheduleItemTimes(input: {
  isAllDay: boolean;
  startDate: string;
  endDate?: string;
  startTime: string;
  endTime: string;
}): { ok: false; message: string } | null {
  if (normalizeScheduleItemAllDay(input.isAllDay)) return null;
  if (!input.startTime || !input.endTime) {
    return { ok: false, message: "Start and end times are required unless the item is all day." };
  }
  const endDate = input.endDate || input.startDate;
  if (input.startDate === endDate && input.endTime <= input.startTime) {
    return { ok: false, message: "End time must be after start time." };
  }
  return null;
}

/** What insert/update writes. All-day items store no clock time. */
export function persistScheduleItemTimes(
  isAllDay: boolean,
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): { start_time: string | null; end_time: string | null } {
  if (normalizeScheduleItemAllDay(isAllDay)) {
    return { start_time: null, end_time: null };
  }
  const start = startTime?.trim() ? startTime.trim().slice(0, 5) : null;
  const end = endTime?.trim() ? endTime.trim().slice(0, 5) : null;
  return { start_time: start, end_time: end };
}

/**
 * What Month/Week/Day/Agenda render. Recurring occurrences reuse these
 * same clock times — the series repeats the appointment, not a shifted one.
 */
export function displayScheduleItemTimes(
  isAllDay: boolean,
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): { time: string | null; endTime: string | null } {
  if (normalizeScheduleItemAllDay(isAllDay)) return { time: null, endTime: null };
  return {
    time: startTime?.slice(0, 5) ?? null,
    endTime: endTime?.slice(0, 5) ?? null,
  };
}
