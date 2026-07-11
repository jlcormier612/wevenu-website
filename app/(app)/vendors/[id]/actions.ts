"use server";

import { revalidatePath } from "next/cache";

import { addVendorReview, updateVendor_ } from "@/lib/vendors/service";
import type { VendorActionResult, VendorInput, VendorReviewInput } from "@/lib/vendors/types";

export async function updateVendorAction(vendorId: string, input: VendorInput): Promise<VendorActionResult> {
  const result = await updateVendor_(vendorId, input);
  if (result.ok) { revalidatePath(`/vendors/${vendorId}`); revalidatePath("/vendors"); }
  return result;
}

export async function addVendorReviewAction(vendorId: string, input: VendorReviewInput): Promise<VendorActionResult> {
  const result = await addVendorReview(vendorId, input);
  if (result.ok) revalidatePath(`/vendors/${vendorId}`);
  return result;
}
