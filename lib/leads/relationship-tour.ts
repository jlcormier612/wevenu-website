/**
 * Relationship-card Venue Tour write policy (Phase 2 — split intents).
 *
 * Three locked write paths (must stay distinct):
 *   1. future_schedule — create/reschedule occupying appointment (availability yes)
 *   2. complete_scheduled — mark an existing scheduled/confirmed tour completed
 *      without touching scheduled_at (availability no)
 *   3. walk_in — insert a NEW completed row with scheduled_at NULL (availability no)
 *
 * Date-only is always a tour rejection (never invents noon). Clearing the date
 * cancels an occupying scheduled/confirmed appointment only.
 */

export const TOUR_TIME_REQUIRED = "A tour time is required to schedule a venue tour.";

export class LeadTourWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeadTourWriteError";
  }
}

export type ExistingLeadTour = {
  id: string;
  status: string;
  scheduledAt: string | null;
  origin: string;
};

export type LeadTourWriteDecision =
  | { action: "noop" }
  | { action: "clear" }
  | { action: "reject"; message: string }
  | { action: "future_schedule"; tourDate: string; tourTime: string; notes: string }
  | {
      action: "complete_scheduled";
      appointmentId: string;
      actualDate: string;
      actualTime: string;
      notes: string;
    }
  | { action: "complete_without_actual"; appointmentId: string; notes: string }
  | { action: "notes_only"; appointmentId: string; notes: string }
  | { action: "walk_in"; actualDate: string; actualTime: string; notes: string }
  | {
      action: "actual_only";
      appointmentId: string;
      actualDate: string;
      actualTime: string;
      notes: string;
    };

/** Prefer explicit actual fields; fall back to the schedule fields for walk-ins / legacy forms. */
export function resolveActualOccurrenceClock(input: {
  tourDate: string;
  tourTime: string;
  tourActualDate?: string;
  tourActualTime?: string;
}): { actualDate: string; actualTime: string } {
  const actualDate = (input.tourActualDate ?? "").trim() || input.tourDate.trim();
  const actualTime = ((input.tourActualTime ?? "").trim() || input.tourTime.trim()).slice(0, 5);
  return { actualDate, actualTime };
}

function isOccupyingStatus(status: string): boolean {
  return status === "scheduled" || status === "confirmed";
}

/**
 * Decide which tour write intent the Relationship card is requesting.
 * Follow-up / next-action fields are handled separately by the caller.
 */
export function resolveLeadTourWrite(input: {
  tourDate: string;
  tourTime: string;
  tourCompleted: boolean;
  tourNotes: string;
  tourActualDate?: string;
  tourActualTime?: string;
  existing: ExistingLeadTour | null;
}): LeadTourWriteDecision {
  const tourDate = input.tourDate.trim();
  const tourTime = input.tourTime.trim().slice(0, 5);
  const notes = input.tourNotes.trim();
  const existing = input.existing;
  const explicitDate = (input.tourActualDate ?? "").trim();
  const explicitTime = (input.tourActualTime ?? "").trim().slice(0, 5);
  const { actualDate, actualTime } = resolveActualOccurrenceClock(input);

  if (input.tourCompleted) {
    // An occupying appointment's booked slot is not an occurrence. Completing
    // it without an explicit actual time records completion only.
    if (existing && isOccupyingStatus(existing.status) && !explicitDate && !explicitTime) {
      return { action: "complete_without_actual", appointmentId: existing.id, notes };
    }
    if (existing && existing.status === "completed" && !explicitDate && !explicitTime) {
      return { action: "notes_only", appointmentId: existing.id, notes };
    }
    // Completing / editing actual uses the actual clock. An empty schedule
    // field is allowed when an occupying row already carries scheduled_at.
    if (!actualDate) {
      if (existing && isOccupyingStatus(existing.status)) return { action: "clear" };
      return { action: "noop" };
    }
    if (!actualTime) {
      return { action: "reject", message: TOUR_TIME_REQUIRED };
    }
    if (existing && isOccupyingStatus(existing.status)) {
      return {
        action: "complete_scheduled",
        appointmentId: existing.id,
        actualDate,
        actualTime,
        notes,
      };
    }
    if (existing && existing.status === "completed" && existing.origin === "scheduled") {
      return {
        action: "actual_only",
        appointmentId: existing.id,
        actualDate,
        actualTime,
        notes,
      };
    }
    if (existing && existing.origin === "walk_in" && existing.status === "completed") {
      return {
        action: "actual_only",
        appointmentId: existing.id,
        actualDate,
        actualTime,
        notes,
      };
    }
    // No occupying appointment — genuine walk-in creates a NEW row.
    return { action: "walk_in", actualDate, actualTime, notes };
  }

  if (!tourDate) {
    if (existing && isOccupyingStatus(existing.status)) return { action: "clear" };
    return { action: "noop" };
  }

  if (!tourTime) {
    return { action: "reject", message: TOUR_TIME_REQUIRED };
  }

  return { action: "future_schedule", tourDate, tourTime, notes };
}
