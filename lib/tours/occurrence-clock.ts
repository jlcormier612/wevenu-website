/**
 * Two-clock occurrence: scheduled_at is the booked slot; actual_occurred_at
 * is when the tour happened. Completed recency and display must never use a
 * future scheduled_at (the Oct 4 / -69h defect).
 */

export function tourOccurrenceIso(tour: {
  actual_occurred_at?: string | null;
  completed_at?: string | null;
}): string | null {
  return tour.actual_occurred_at ?? tour.completed_at ?? null;
}

/** Hours since occurrence, never negative. */
export function completedTourHoursAgo(occurrenceIso: string, nowMs = Date.now()): number {
  const ms = Date.parse(occurrenceIso);
  if (Number.isNaN(ms)) return 0;
  return Math.max(0, Math.round((nowMs - ms) / 3_600_000));
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
