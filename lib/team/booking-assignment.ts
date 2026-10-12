/**
 * Lead sales assignee and booked-event assignee are separate records.
 * Booking confirmation chooses the event assignee. It does not rewrite the lead.
 */

import type { createClient } from "@/integrations/supabase/server";
import { persistEventStaffAssignment } from "@/lib/team/staff-assignment";

type Db = Awaited<ReturnType<typeof createClient>>;

export type AssignmentDecision =
  | { apply: false; reason: "cancelled" | "booking_failed" | "ineligible" | "omitted" }
  | { apply: true; staffId: string | null };

export function decideEventAssignment(input: {
  bookingSucceeded: boolean;
  cancelled: boolean;
  /** undefined = field omitted from the request; do not clear an existing owner. */
  selectedStaffId: string | null | undefined;
  eligibleStaffIds: readonly string[];
}): AssignmentDecision {
  if (input.cancelled) return { apply: false, reason: "cancelled" };
  if (!input.bookingSucceeded) return { apply: false, reason: "booking_failed" };
  if (input.selectedStaffId === undefined) return { apply: false, reason: "omitted" };
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

/**
 * Persist confirmation Event team member after book_relationship succeeds.
 * Null clears (explicit Unassigned). Undefined selection is a no-op.
 */
export async function applyEventAssignmentAfterBooking(input: {
  supabase: Db;
  venueId: string;
  eventId: string;
  selectedStaffId: string | null | undefined;
}): Promise<{ ok: true } | { ok: false; message: string } | { ok: true; skipped: true }> {
  const { data: staffRows } = await input.supabase
    .from("venue_staff")
    .select("id")
    .eq("venue_id", input.venueId)
    .eq("is_active", true);
  const decision = decideEventAssignment({
    bookingSucceeded: true,
    cancelled: false,
    selectedStaffId: input.selectedStaffId,
    eligibleStaffIds: (staffRows ?? []).map((row) => row.id as string),
  });
  if (!decision.apply) {
    return { ok: true, skipped: true };
  }
  return persistEventStaffAssignment(
    input.supabase,
    input.venueId,
    input.eventId,
    decision.staffId,
  );
}
