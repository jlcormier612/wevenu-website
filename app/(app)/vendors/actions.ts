"use server";

import { revalidatePath } from "next/cache";

import { createVendor, deleteVendor_ } from "@/lib/vendors/service";
import type { CreateVendorResult, VendorActionResult, VendorInput } from "@/lib/vendors/types";

export async function createVendorAction(input: VendorInput): Promise<CreateVendorResult> {
  const result = await createVendor(input);
  if (result.ok) revalidatePath("/vendors");
  return result;
}

export async function deleteVendorAction(vendorId: string): Promise<VendorActionResult> {
  const result = await deleteVendor_(vendorId);
  if (result.ok) revalidatePath("/vendors");
  return result;
}
