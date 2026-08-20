"use server";
import { revalidatePath } from "next/cache";
import {
  createVendorTask,
  completeVendorTask,
  uncompleteVendorTask,
  deleteVendorTask,
} from "@/lib/vendor-tasks/service";
import type { VendorActionResult, VendorPersonalTaskInput } from "@/lib/vendors/types";

export async function createVendorTaskAction(
  input: VendorPersonalTaskInput,
): Promise<VendorActionResult & { id?: string }> {
  const result = await createVendorTask(input);
  if (result.ok) {
    revalidatePath("/vendor/tasks");
    revalidatePath("/vendor/dashboard");
  }
  return result;
}

export async function completeVendorTaskAction(id: string): Promise<VendorActionResult> {
  const result = await completeVendorTask(id);
  if (result.ok) {
    revalidatePath("/vendor/tasks");
    revalidatePath("/vendor/dashboard");
  }
  return result;
}

export async function uncompleteVendorTaskAction(id: string): Promise<VendorActionResult> {
  const result = await uncompleteVendorTask(id);
  if (result.ok) {
    revalidatePath("/vendor/tasks");
    revalidatePath("/vendor/dashboard");
  }
  return result;
}

export async function deleteVendorTaskAction(id: string): Promise<VendorActionResult> {
  const result = await deleteVendorTask(id);
  if (result.ok) {
    revalidatePath("/vendor/tasks");
    revalidatePath("/vendor/dashboard");
  }
  return result;
}
