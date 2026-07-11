"use server";

import { revalidatePath } from "next/cache";

import { assignVendor, removeVendorAssignment, updateVendorAssignment_ } from "@/lib/vendors/service";
import { addRecommendation, removeRecommendation } from "@/lib/vendor-recommendations/service";
import type { EventVendorAssignment, VendorActionResult, VendorAssignmentInput } from "@/lib/vendors/types";
import type { RecommendationActionResult } from "@/lib/vendor-recommendations/types";

function revalidateEvent(eventId: string) {
  revalidatePath(`/events/${eventId}`);
}

// ── Recommendations — venue-side ("choose vendors from the Library to
// recommend to this specific client," Vendor Management Next Iteration) ───

export async function recommendVendorAction(eventId: string, vendorId: string, note: string | null): Promise<RecommendationActionResult> {
  const result = await addRecommendation(eventId, vendorId, note);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function unrecommendVendorAction(recommendationId: string, eventId: string): Promise<RecommendationActionResult> {
  const result = await removeRecommendation(recommendationId);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function assignVendorAction(
  eventId: string, input: VendorAssignmentInput,
): Promise<{ ok: true; assignment: EventVendorAssignment } | VendorActionResult> {
  const result = await assignVendor(eventId, input);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function removeVendorAssignmentAction(
  assignmentId: string, eventId: string,
): Promise<VendorActionResult> {
  const result = await removeVendorAssignment(assignmentId);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function updateVendorAssignmentAction(
  assignmentId: string, eventId: string,
  input: { arrivalTime: string; setupLocation: string; loadInNotes: string; notes: string },
): Promise<VendorActionResult> {
  const result = await updateVendorAssignment_(assignmentId, input);
  if (result.ok) revalidateEvent(eventId);
  return result;
}
