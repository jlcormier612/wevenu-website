"use server";

import { revalidatePath } from "next/cache";

import { assignVendor, removeVendorAssignment, updateVendorAssignment_ } from "@/lib/vendors/service";
import { createVendorPortalSession } from "@/lib/vendor-portal/service";
import type { EventVendorAssignment, VendorActionResult, VendorAssignmentInput } from "@/lib/vendors/types";

function revalidateEvent(eventId: string) {
  revalidatePath(`/events/${eventId}`);
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

export async function createVendorPortalLinkAction(
  vendorId: string, vendorName: string,
): Promise<{ ok: true; token: string } | { ok: false }> {
  const token = await createVendorPortalSession(vendorId, vendorName);
  return token ? { ok: true, token } : { ok: false };
}
