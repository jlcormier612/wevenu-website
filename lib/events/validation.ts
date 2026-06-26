/**
 * Events business-logic: validation rules. Pure functions.
 */
import { EVENT_STATUSES } from "@/lib/events/constants";
import type { EventErrors, EventInput, EventStatus, TeamMemberInput } from "@/lib/events/types";

export function validateEventInput(input: EventInput): EventErrors {
  const errors: EventErrors = {};
  if (!input.name.trim()) errors.name = "Event name is required.";
  if (!input.eventDate) errors.eventDate = "Event date is required.";
  if (input.guestCount.trim()) {
    const n = Number(input.guestCount);
    if (!Number.isInteger(n) || n < 0) errors.guestCount = "Guest count must be a whole number.";
  }
  if (input.startTime && input.endTime && input.endTime <= input.startTime)
    errors.endTime = "End time must be after start time.";
  return errors;
}

export function validateEventStatus(status: string): status is EventStatus {
  return EVENT_STATUSES.some((s) => s.value === status);
}

export function validateTeamMemberInput(input: TeamMemberInput): EventErrors {
  const errors: EventErrors = {};
  if (!input.fullName.trim()) errors.fullName = "Name is required.";
  return errors;
}
