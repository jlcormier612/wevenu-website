/**
 * Prefill for the manual Booked confirmation. These values are not booked
 * until the venue submits them.
 */
import type { DateHold, VenueSpace } from "@/lib/availability/types";
import type { ConfirmedBookingOccupancy } from "@/lib/booking-journey/confirmed-occupancy";
import type { LeadEventSpacePreference } from "@/lib/leads/space-preferences";
import type { EventSpaceAssignmentInput } from "@/lib/venue-spaces/assignments";
import { primarySpaceIdFromAssignments } from "@/lib/venue-spaces/assignments";
import { resolveExperienceProfile } from "@/lib/event-experience";

export type BookingConfirmationDraft = {
  eventType: string | null;
  eventDate: string;
  eventEndDate: string;
  startTime: string;
  endTime: string;
  spaceId: string;
  assignments: EventSpaceAssignmentInput[];
  spaces: VenueSpace[];
  maxSimultaneousEvents: number;
  spaceOperatingMode: "single" | "multi";
  /** Lead being booked. Own holds are excluded from the conflict check by this id. */
  leadId: string | null;
  /** venues.hold_blocks_availability. Default true matches the column default. */
  holdBlocksAvailability: boolean;
  /** This lead has at least one active hold. Used for confirmation copy, not as a conflict. */
  hasOwnActiveHold: boolean;
  /** Active hold dates for this lead at the moment the draft was built. */
  sourceHoldDates: string[];
};

function hhmm(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed.slice(0, 5) : "";
}

export function prefillBookingConfirmation(input: {
  eventType: string | null;
  eventDate: string | null;
  endDate: string | null;
  plannedSpaceId: string | null;
  holds?: Array<Pick<DateHold, "status" | "holdDate" | "startTime" | "endTime" | "spaceId" | "spaceIds">>;
  preferences?: LeadEventSpacePreference[];
  assignments?: EventSpaceAssignmentInput[];
}): Omit<BookingConfirmationDraft, "spaces" | "maxSimultaneousEvents" | "spaceOperatingMode" | "leadId" | "holdBlocksAvailability" | "hasOwnActiveHold" | "sourceHoldDates"> {
  const activeHolds = (input.holds ?? []).filter((hold) => hold.status === "active");
  const eventDate = input.eventDate?.trim()
    || activeHolds.find((hold) => hold.holdDate)?.holdDate
    || "";
  const holdOnDate = activeHolds.find((hold) => hold.holdDate === eventDate) ?? activeHolds[0];
  const preferenceAssignments: EventSpaceAssignmentInput[] = (input.preferences ?? [])
    .filter((row) => row.preferenceKind === "venue_space" && row.spaceId)
    .map((row) => ({
      useKey: row.useKey,
      useLabel: row.useKey,
      spaceId: row.spaceId!,
    }));
  const assignments = (input.assignments ?? []).filter((row) => row.spaceId.trim()).length > 0
    ? (input.assignments ?? []).filter((row) => row.spaceId.trim())
    : preferenceAssignments;
  const weddingFamily = resolveExperienceProfile(input.eventType).isWeddingSpecific;
  const fromAssignments = primarySpaceIdFromAssignments(assignments, { weddingFamily });
  const holdSpace = holdOnDate?.spaceIds?.[0] || holdOnDate?.spaceId || "";
  return {
    eventType: input.eventType,
    eventDate,
    eventEndDate: input.endDate?.trim() || "",
    startTime: hhmm(holdOnDate?.startTime),
    endTime: hhmm(holdOnDate?.endTime),
    spaceId: input.plannedSpaceId?.trim() || fromAssignments || holdSpace || "",
    assignments,
  };
}

export function draftToOccupancy(
  draft: Pick<BookingConfirmationDraft, "eventDate" | "eventEndDate" | "startTime" | "endTime" | "spaceId" | "assignments" | "eventType">,
): ConfirmedBookingOccupancy {
  const weddingFamily = resolveExperienceProfile(draft.eventType).isWeddingSpecific;
  const assignments = draft.assignments.filter((row) => row.spaceId.trim());
  const spaceId = assignments.length > 0
    ? primarySpaceIdFromAssignments(assignments, { weddingFamily })
    : (draft.spaceId.trim() || null);
  return {
    eventDate: draft.eventDate.trim(),
    eventEndDate: draft.eventEndDate.trim() || null,
    startTime: hhmm(draft.startTime) || null,
    endTime: hhmm(draft.endTime) || null,
    spaceId,
    assignments,
  };
}
