/**
 * Date-specific vendor availability for a couple's event date.
 *
 * Couple-facing status is Available | Unavailable | Not confirmed.
 * Booked vs blocked is an internal distinction — both are Unavailable to the couple.
 *
 * Booked is derived from secured HTC event assignments (system of record),
 * not from a manually painted calendar cell.
 */

export type CoupleAvailabilityStatus = "available" | "unavailable" | "not_confirmed";
export type VendorDateKind = "available" | "blocked" | "booked" | "not_confirmed";

export type CoupleDateAvailability = {
  status: CoupleAvailabilityStatus;
  kind: VendorDateKind;
  eventDate: string;
};

export function resolveVendorDateAvailability(input: {
  eventDate: string;
  eventBooked: boolean;
  manuallyBlocked: boolean;
  vendorHasManualHistory: boolean;
}): CoupleDateAvailability {
  const eventDate = input.eventDate;
  if (input.eventBooked) {
    return { eventDate, status: "unavailable", kind: "booked" };
  }
  if (input.manuallyBlocked) {
    return { eventDate, status: "unavailable", kind: "blocked" };
  }
  if (input.vendorHasManualHistory) {
    return { eventDate, status: "available", kind: "available" };
  }
  return { eventDate, status: "not_confirmed", kind: "not_confirmed" };
}

export function coupleAvailabilityLabel(status: CoupleAvailabilityStatus): string {
  if (status === "available") return "Available";
  if (status === "unavailable") return "Unavailable";
  return "Availability not confirmed";
}

/** Inclusive event_date … coalesce(event_end_date, event_date). */
export function assignmentCoversDate(
  assignmentStart: string | null | undefined,
  assignmentEnd: string | null | undefined,
  queryDate: string,
): boolean {
  if (!assignmentStart) return false;
  const end = assignmentEnd && assignmentEnd > assignmentStart ? assignmentEnd : assignmentStart;
  return queryDate >= assignmentStart && queryDate <= end;
}
