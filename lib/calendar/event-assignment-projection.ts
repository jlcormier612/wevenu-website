/**
 * Project booked event component assignments onto calendar days.
 *
 * Canonical truth is event_space_assignments.scheduled_date (+ start/end).
 * Do not paint every component onto every day of the event's protected range.
 */

export type AssignmentWindowInput = {
  spaceId: string;
  useLabel: string | null;
  startTime: string | null;
  endTime: string | null;
  /** YYYY-MM-DD when the component occupies a specific day. */
  scheduledDate: string | null;
};

export type ProjectedAssignmentItem = {
  date: string;
  spaceId: string;
  useLabel: string | null;
  startTime: string | null;
  endTime: string | null;
  index: number;
};

/**
 * Timed assignments with a scheduled_date appear only on that date (when inside
 * the visible month). Timed assignments missing scheduled_date fall back to
 * each protected event day (legacy). Untimed events keep a single item per
 * protected day without fabricating component rows.
 */
export function projectAssignmentWindowsOntoCalendarDates(input: {
  protectedDates: readonly string[];
  windows: readonly AssignmentWindowInput[];
}): ProjectedAssignmentItem[] | "untimed" {
  const timed = input.windows.filter((row) => row.startTime && row.endTime);
  if (timed.length === 0) return "untimed";

  const dated = timed.filter((row) => !!row.scheduledDate);
  const legacy = timed.filter((row) => !row.scheduledDate);
  const out: ProjectedAssignmentItem[] = [];
  let index = 0;

  for (const row of dated) {
    const date = row.scheduledDate!;
    if (!input.protectedDates.includes(date)) continue;
    out.push({
      date,
      spaceId: row.spaceId,
      useLabel: row.useLabel,
      startTime: row.startTime,
      endTime: row.endTime,
      index: index++,
    });
  }

  for (const date of input.protectedDates) {
    for (const row of legacy) {
      out.push({
        date,
        spaceId: row.spaceId,
        useLabel: row.useLabel,
        startTime: row.startTime,
        endTime: row.endTime,
        index: index++,
      });
    }
  }

  return out;
}
