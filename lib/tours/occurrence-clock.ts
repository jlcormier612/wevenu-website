/**
 * Two-clock occurrence: scheduled_at is the booked slot; actual_occurred_at
 * is when the tour happened. Completed recency and display must never use a
 * future scheduled_at (the Oct 4 / -69h defect).
 *
 * completed_at is a third fact: when staff marked the record completed.
 * It must never silently become the actual occurrence.
 */

export function tourOccurrenceIso(tour: {
  actual_occurred_at?: string | null;
  completed_at?: string | null;
}): string | null {
  return tour.actual_occurred_at ?? tour.completed_at ?? null;
}

/** True when actual and scheduled wall times differ (or only one is set). */
export function tourActualDiffersFromScheduled(tour: {
  scheduledAt?: string | null;
  scheduled_at?: string | null;
  actualOccurredAt?: string | null;
  actual_occurred_at?: string | null;
}): boolean {
  const scheduled = tour.scheduledAt ?? tour.scheduled_at ?? null;
  const actual = tour.actualOccurredAt ?? tour.actual_occurred_at ?? null;
  if (!scheduled || !actual) return Boolean(actual && !scheduled);
  return scheduled !== actual;
}

/** Hours since occurrence, never negative. */
export function completedTourHoursAgo(occurrenceIso: string, nowMs = Date.now()): number {
  const ms = Date.parse(occurrenceIso);
  if (Number.isNaN(ms)) return 0;
  return Math.max(0, Math.round((nowMs - ms) / 3_600_000));
}

/** Two minutes of clock skew before an occurrence is treated as still in the future. */
const FUTURE_SKEW_MS = 120_000;

export const FUTURE_ACTUAL_OCCURRENCE_MESSAGE =
  "The actual occurrence time can’t be in the future. Enter when it happened.";

export function actualOccurrenceIsFuture(iso: string, nowMs = Date.now()): boolean {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return false;
  return ms > nowMs + FUTURE_SKEW_MS;
}

/**
 * Prefill actual date/time from the booked slot only when that slot is not
 * still ahead. A future scheduled time is not evidence the tour occurred.
 */
export function prefillActualFromScheduled(args: {
  scheduledAt: string | null;
  timezone: string | null;
  nowMs?: number;
  utcToParts: (iso: string, timezone: string | null) => { date: string; time: string };
}): { date: string; time: string; fromScheduled: boolean; scheduledStillAhead: boolean } {
  const nowMs = args.nowMs ?? Date.now();
  if (!args.scheduledAt) {
    return { date: "", time: "", fromScheduled: false, scheduledStillAhead: false };
  }
  if (actualOccurrenceIsFuture(args.scheduledAt, nowMs)) {
    return { date: "", time: "", fromScheduled: false, scheduledStillAhead: true };
  }
  const parts = args.utcToParts(args.scheduledAt, args.timezone);
  return { date: parts.date, time: parts.time, fromScheduled: true, scheduledStillAhead: false };
}

export function completedTourDisplayClockIso(tour: {
  status: string;
  origin?: string | null;
  scheduled_at?: string | null;
  scheduledAt?: string | null;
  actual_occurred_at?: string | null;
  actualOccurredAt?: string | null;
}): string | null {
  const scheduled = tour.scheduled_at ?? tour.scheduledAt ?? null;
  const actual = tour.actual_occurred_at ?? tour.actualOccurredAt ?? null;
  if (tour.origin === "walk_in" || !scheduled) return actual;
  if (tour.status === "completed" && actual) return actual;
  return scheduled;
}
