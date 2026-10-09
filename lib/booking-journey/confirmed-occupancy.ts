/**
 * Occupancy the venue explicitly submitted on a manual Booked action.
 * Prefilled values are not confirmed until this object is submitted.
 * Storage stays on the Event: date, end date, times, space_id, and
 * event_space_assignments. This is not a second occupancy model.
 */
import { primarySpaceIdFromAssignments, type EventSpaceAssignmentInput } from "@/lib/venue-spaces/assignments";

export type ConfirmedBookingOccupancy = {
  eventDate: string;
  eventEndDate: string | null;
  startTime: string | null;
  endTime: string | null;
  spaceId: string | null;
  assignments: EventSpaceAssignmentInput[];
  /** This lead's active hold dates when confirmation opened. Not another lead's holds. */
  sourceHoldDates?: string[];
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}(:\d{2})?$/;

function cleanTime(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  return trimmed.length >= 5 ? trimmed.slice(0, 5) : trimmed;
}

export function selectedSpaceIds(value: ConfirmedBookingOccupancy): string[] {
  const ids = new Set<string>();
  if (value.spaceId?.trim()) ids.add(value.spaceId.trim());
  for (const row of value.assignments) {
    const id = row.spaceId?.trim();
    if (id) ids.add(id);
  }
  return [...ids];
}

/** UI and service gate. The database booking path remains the availability authority. */
export function bookingConfirmationError(
  value: ConfirmedBookingOccupancy,
  maxSimultaneousEvents: number,
): string | null {
  const eventDate = value.eventDate.trim();
  if (!DATE.test(eventDate)) {
    return "A date is required before booking this relationship.";
  }
  const end = value.eventEndDate?.trim() ?? "";
  if (end && !DATE.test(end)) {
    return "Enter a valid end date.";
  }
  if (end && end < eventDate) {
    return "The end date cannot be before the event date.";
  }
  for (const time of [value.startTime, value.endTime]) {
    const trimmed = time?.trim() ?? "";
    if (trimmed && !TIME.test(trimmed)) {
      return "Enter a valid start and end time.";
    }
  }
  for (const row of value.assignments) {
    const start = cleanTime(row.startTime);
    const endTime = cleanTime(row.endTime);
    if (!start || !endTime) {
      return "Enter a start and an end time for each assigned space.";
    }
    if (endTime <= start) {
      return "The end time must be after the start time.";
    }
  }
  if (maxSimultaneousEvents >= 2 && selectedSpaceIds(value).length === 0) {
    return "Assign an Event Space before booking. This venue can host more than one event at the same time.";
  }
  return null;
}

export function toConfirmedBookingOccupancy(input: {
  eventDate: string;
  eventEndDate: string;
  startTime: string;
  endTime: string;
  spaceId: string;
  assignments: EventSpaceAssignmentInput[];
  weddingFamily: boolean;
}): ConfirmedBookingOccupancy {
  const assignments = input.assignments
    .filter((row) => row.useKey.trim() && row.spaceId.trim())
    .map((row) => ({
      ...row,
      startTime: cleanTime(row.startTime),
      endTime: cleanTime(row.endTime),
    }));
  const primary = assignments.length > 0
    ? primarySpaceIdFromAssignments(assignments, { weddingFamily: input.weddingFamily })
    : (input.spaceId.trim() || null);
  const timedStarts = assignments.map((row) => row.startTime).filter((time): time is string => !!time);
  const timedEnds = assignments.map((row) => row.endTime).filter((time): time is string => !!time);
  return {
    eventDate: input.eventDate.trim(),
    eventEndDate: input.eventEndDate.trim() || null,
    startTime: timedStarts.length > 0 ? [...timedStarts].sort()[0]! : cleanTime(input.startTime),
    endTime: timedEnds.length > 0 ? [...timedEnds].sort().at(-1)! : cleanTime(input.endTime),
    spaceId: primary,
    assignments,
  };
}
