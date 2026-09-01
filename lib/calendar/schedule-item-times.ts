/**
 * All-day vs timed Schedule Items.
 *
 * calendar_blocks.start_time / end_time are venue-local wall-clock `time`
 * values (HH:MM), not UTC timestamps. Display and persist must not convert
 * them through a Date in another zone — the venue timezone already decided
 * which calendar day the item sits on; the clock time is what the
 * coordinator typed.
 */

export function validateScheduleItemTimes(input: {
  isAllDay: boolean;
  startDate: string;
  endDate?: string;
  startTime: string;
  endTime: string;
}): { ok: false; message: string } | null {
  if (input.isAllDay) return null;
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
  return {
    start_time: !isAllDay && startTime ? startTime : null,
    end_time: !isAllDay && endTime ? endTime : null,
  };
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
  if (isAllDay) return { time: null, endTime: null };
  return {
    time: startTime?.slice(0, 5) ?? null,
    endTime: endTime?.slice(0, 5) ?? null,
  };
}
