"use server";

import { revalidatePath } from "next/cache";

import { updateVendor_ } from "@/lib/vendors/service";
import type { VendorActionResult, VendorInput } from "@/lib/vendors/types";

export async function updateVendorAction(vendorId: string, input: VendorInput): Promise<VendorActionResult> {
  const result = await updateVendor_(vendorId, input);
  if (result.ok) { revalidatePath(`/vendors/${vendorId}`); revalidatePath("/vendors"); }
  return result;
}
