"use server";
import { revalidatePath } from "next/cache";
import {
  completeEventTask,
  getVendorEventDetail,
  toggleAssignmentCheckin,
  updateAssignmentNotes,
} from "@/lib/vendor-events/service";
import {
  completeVendorTask,
  createVendorTask,
  returnVendorTask,
  uncompleteVendorTask,
  updateVendorTaskCoupleVisibility,
} from "@/lib/vendor-tasks/service";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { getVendorHandbookForEvent, type VendorHandbook } from "@/lib/vendor-handbook/service";
import { requestAssignmentRemoval } from "@/lib/vendor-removal-requests/service";
import type {
  VendorActionResult,
  VendorPersonalTaskInput,
  VendorTaskCoupleVisibility,
} from "@/lib/vendors/types";

export async function getVendorHandbookForEventAction(eventId: string): Promise<VendorHandbook | null> {
  return getVendorHandbookForEvent(eventId);
}

/** Related product venue for feedback context on an event workspace. */
export async function getVendorEventVenueIdAction(
  assignmentId: string,
): Promise<string | null> {
  const vendorUser = await getVendorUser();
  if (!vendorUser) return null;
  const detail = await getVendorEventDetail(assignmentId, vendorUser.vendorId);
  return detail?.venueId ?? null;
}

export async function completeEventTaskAction(
  taskId:       string,
  assignmentId: string,
): Promise<VendorActionResult> {
  const vendorUser = await getVendorUser();
  if (!vendorUser) return { ok: false, message: "No vendor account found." };
  const result = await completeEventTask(taskId);
  if (result.ok) revalidatePath(`/vendor/events/${assignmentId}`);
  return result;
}

/** Create a personal task scoped to this event (relative days_offset preferred when set). */
export async function createPersonalTaskAction(
  assignmentId: string,
  input: VendorPersonalTaskInput,
): Promise<VendorActionResult & { id?: string }> {
  const result = await createVendorTask(input);
  if (result.ok) {
    revalidatePath(`/vendor/events/${assignmentId}`);
    revalidatePath("/vendor/dashboard");
  }
  return result;
}

export async function completePersonalTaskAction(
  taskId:       string,
  assignmentId: string,
): Promise<VendorActionResult> {
  const result = await completeVendorTask(taskId);
  if (result.ok) {
    revalidatePath(`/vendor/events/${assignmentId}`);
    revalidatePath("/vendor/dashboard");
  }
  return result;
}

export async function returnPersonalTaskAction(
  taskId: string,
  assignmentId: string,
  note: string,
): Promise<VendorActionResult> {
  const result = await returnVendorTask(taskId, note);
  if (result.ok) {
    revalidatePath(`/vendor/events/${assignmentId}`);
    revalidatePath("/vendor/dashboard");
  }
  return result;
}

export async function uncompletePersonalTaskAction(
  taskId:       string,
  assignmentId: string,
): Promise<VendorActionResult> {
  const result = await uncompleteVendorTask(taskId);
  if (result.ok) {
    revalidatePath(`/vendor/events/${assignmentId}`);
    revalidatePath("/vendor/dashboard");
  }
  return result;
}

export async function updatePersonalTaskCoupleVisibilityAction(
  taskId: string,
  assignmentId: string,
  coupleVisibility: VendorTaskCoupleVisibility,
  opts?: { requireVendorConfirmation?: boolean },
): Promise<VendorActionResult> {
  const result = await updateVendorTaskCoupleVisibility(taskId, coupleVisibility, opts);
  if (result.ok) {
    revalidatePath(`/vendor/events/${assignmentId}`);
    revalidatePath("/vendor/dashboard");
  }
  return result;
}

export async function updateAssignmentNotesAction(
  assignmentId: string,
  notes:        string,
): Promise<VendorActionResult> {
  const result = await updateAssignmentNotes(assignmentId, notes);
  if (result.ok) revalidatePath(`/vendor/events/${assignmentId}`);
  return result;
}

export async function toggleAssignmentCheckinAction(
  assignmentId: string,
  field: "checked_in" | "setup_complete",
): Promise<VendorActionResult> {
  const result = await toggleAssignmentCheckin(assignmentId, field);
  if (result.ok) revalidatePath(`/vendor/events/${assignmentId}`);
  return result;
}

export async function requestToLeaveEventAction(
  assignmentId: string,
  reason: string | null,
): Promise<VendorActionResult> {
  const result = await requestAssignmentRemoval(assignmentId, reason);
  if (result.ok) revalidatePath(`/vendor/events/${assignmentId}`);
  return result;
}
