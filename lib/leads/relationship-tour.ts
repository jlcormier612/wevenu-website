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
  | { action: "walk_in"; actualDate: string; actualTime: string; notes: string }
  | {
      action: "actual_only";
      appointmentId: string;
      actualDate: string;
      actualTime: string;
      notes: string;
    };

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
  existing: ExistingLeadTour | null;
}): LeadTourWriteDecision {
  const tourDate = input.tourDate.trim();
  const tourTime = input.tourTime.trim().slice(0, 5);
  const notes = input.tourNotes.trim();
  const existing = input.existing;

  if (!tourDate) {
    if (existing && isOccupyingStatus(existing.status)) return { action: "clear" };
    return { action: "noop" };
  }

  if (!tourTime) {
    return { action: "reject", message: TOUR_TIME_REQUIRED };
  }

  if (input.tourCompleted) {
    if (existing && isOccupyingStatus(existing.status)) {
      return {
        action: "complete_scheduled",
        appointmentId: existing.id,
        actualDate: tourDate,
        actualTime: tourTime,
        notes,
      };
    }
    if (existing && existing.status === "completed" && existing.origin === "scheduled") {
      return {
        action: "actual_only",
        appointmentId: existing.id,
        actualDate: tourDate,
        actualTime: tourTime,
        notes,
      };
    }
    if (existing && existing.origin === "walk_in" && existing.status === "completed") {
      return {
        action: "actual_only",
        appointmentId: existing.id,
        actualDate: tourDate,
        actualTime: tourTime,
        notes,
      };
    }
    // No occupying appointment — genuine walk-in creates a NEW row.
    return { action: "walk_in", actualDate: tourDate, actualTime: tourTime, notes };
  }

  return { action: "future_schedule", tourDate, tourTime, notes };
}
