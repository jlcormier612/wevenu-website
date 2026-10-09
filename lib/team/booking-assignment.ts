/**
 * Lead sales assignee and booked-event assignee are separate records.
 * Booking confirmation chooses the event assignee. It does not rewrite the lead.
 */

export type AssignmentDecision =
  | { apply: false; reason: "cancelled" | "booking_failed" | "ineligible" }
  | { apply: true; staffId: string | null };

export function decideEventAssignment(input: {
  bookingSucceeded: boolean;
  cancelled: boolean;
  selectedStaffId: string | null;
  eligibleStaffIds: readonly string[];
}): AssignmentDecision {
  if (input.cancelled) return { apply: false, reason: "cancelled" };
  if (!input.bookingSucceeded) return { apply: false, reason: "booking_failed" };
  const staffId = input.selectedStaffId?.trim() || null;
  if (staffId && !input.eligibleStaffIds.includes(staffId)) {
    return { apply: false, reason: "ineligible" };
  }
  return { apply: true, staffId };
}

/** A column update is idempotent — retry does not insert another assignment row. */
export function assignmentWriteIsSingleColumn(): true {
  return true;
}
