"use server";
import { revalidatePath } from "next/cache";
import {
  completeEventTask,
  updateAssignmentNotes,
} from "@/lib/vendor-events/service";
import {
  completeVendorTask,
  uncompleteVendorTask,
} from "@/lib/vendor-tasks/service";
import { getVendorUser } from "@/lib/vendor-auth/service";
import type { VendorActionResult } from "@/lib/vendors/types";

export async function completeEventTaskAction(
  taskId:       string,
  assignmentId: string,
): Promise<VendorActionResult> {
  const vendorUser = await getVendorUser();
  if (!vendorUser) return { ok: false, message: "No vendor account found." };
  const result = await completeEventTask(taskId, vendorUser.vendorId);
  if (result.ok) revalidatePath(`/vendor/events/${assignmentId}`);
  return result;
}

export async function completePersonalTaskAction(
  taskId:       string,
  assignmentId: string,
): Promise<VendorActionResult> {
  const result = await completeVendorTask(taskId);
  if (result.ok) {
    revalidatePath(`/vendor/events/${assignmentId}`);
    revalidatePath("/vendor/tasks");
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
    revalidatePath("/vendor/tasks");
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
