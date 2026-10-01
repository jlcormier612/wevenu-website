/**
 * Venue Tours page list ordering.
 *
 * Upcoming scheduled activities: soonest first (scheduled_at ascending).
 * Past: most recently past first (display clock descending).
 * Archived tours are excluded from Upcoming/Past (list hygiene).
 * Walk-ins (null scheduled_at) are never upcoming — they render via actual_occurred_at in Past.
 *
 * Do not reuse for Inbox (most-recent activity) or conversation messages
 * (newest-first within a thread) — those have different semantics.
 */
import type { TourAppointment } from "@/lib/tours/types";

/** Calendar/list display clock: actual when completed, else scheduled, else walk-in actual. */
export function tourDisplayClockIso(a: TourAppointment): string | null {
  if (a.origin === "walk_in" || !a.scheduledAt) return a.actualOccurredAt;
  if (a.status === "completed" && a.actualOccurredAt) return a.actualOccurredAt;
  return a.scheduledAt;
}

export function compareTourScheduledAtAsc(a: TourAppointment, b: TourAppointment): number {
  const ac = tourDisplayClockIso(a) ?? "";
  const bc = tourDisplayClockIso(b) ?? "";
  if (ac < bc) return -1;
  if (ac > bc) return 1;
  return 0;
}

export function isUpcomingTourAppointment(a: TourAppointment, now: Date): boolean {
  if (a.isArchived) return false;
  if (!a.scheduledAt) return false;
  return (
    a.status !== "cancelled" &&
    a.status !== "completed" &&
    a.status !== "no_show" &&
    new Date(a.scheduledAt) >= now
  );
}

export function isPastTourAppointment(a: TourAppointment, now: Date): boolean {
  if (a.isArchived) return false;
  if (a.status === "completed" || a.status === "no_show") return true;
  if (a.status === "cancelled") return false;
  if (!a.scheduledAt) return Boolean(a.actualOccurredAt);
  return new Date(a.scheduledAt) < now;
}

export function partitionTourAppointmentsForVenueList(
  appointments: TourAppointment[],
  now: Date = new Date(),
): { upcoming: TourAppointment[]; past: TourAppointment[] } {
  const upcoming = appointments
    .filter((a) => isUpcomingTourAppointment(a, now))
    .sort(compareTourScheduledAtAsc);
  const past = appointments
    .filter((a) => isPastTourAppointment(a, now))
    .sort((a, b) => -compareTourScheduledAtAsc(a, b));
  return { upcoming, past };
}
