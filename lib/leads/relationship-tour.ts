/**
 * Relationship-card Venue Tour write policy.
 *
 * A real scheduled Tour requires both a date and a specific time.
 * Date-only must not invent a timestamp (historically noon). Clearing the
 * date cancels an existing appointment. Time without a date is not a Tour.
 */

export const TOUR_TIME_REQUIRED = "A tour time is required to schedule a venue tour.";

export class LeadTourWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeadTourWriteError";
  }
}

export type LeadTourWriteDecision =
  | { action: "clear" }
  | { action: "upsert"; tourDate: string; tourTime: string }
  | { action: "reject"; message: string };

export function resolveLeadTourWrite(input: {
  tourDate: string;
  tourTime: string;
}): LeadTourWriteDecision {
  const tourDate = input.tourDate.trim();
  const tourTime = input.tourTime.trim().slice(0, 5);
  if (!tourDate) return { action: "clear" };
  if (!tourTime) return { action: "reject", message: TOUR_TIME_REQUIRED };
  return { action: "upsert", tourDate, tourTime };
}
