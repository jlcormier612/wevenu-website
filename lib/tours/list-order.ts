/**
 * Venue Tours page list ordering.
 *
 * Upcoming scheduled activities: soonest first (scheduled_at ascending).
 * Past: most recently past first (scheduled_at descending).
 *
 * Do not reuse for Inbox (most-recent activity) or conversation messages
 * (newest-first within a thread) — those have different semantics.
 */
import type { TourAppointment } from "@/lib/tours/types";

export function compareTourScheduledAtAsc(a: TourAppointment, b: TourAppointment): number {
  if (a.scheduledAt < b.scheduledAt) return -1;
  if (a.scheduledAt > b.scheduledAt) return 1;
  return 0;
}

export function isUpcomingTourAppointment(a: TourAppointment, now: Date): boolean {
  return (
    a.status !== "cancelled" &&
    a.status !== "completed" &&
    a.status !== "no_show" &&
    new Date(a.scheduledAt) >= now
  );
}

export function isPastTourAppointment(a: TourAppointment, now: Date): boolean {
  return (
    a.status === "completed" ||
    a.status === "no_show" ||
    (a.status !== "cancelled" && new Date(a.scheduledAt) < now)
  );
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
