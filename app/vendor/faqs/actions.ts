"use server";

import { revalidatePath } from "next/cache";

import {
  createVendorFaq,
  deleteVendorFaq,
  updateVendorFaq,
} from "@/lib/vendor-faqs/service";
import type { VendorActionResult, VendorFaqInput } from "@/lib/vendors/types";

export async function createVendorFaqAction(input: VendorFaqInput): Promise<VendorActionResult & { faqId?: string }> {
  const result = await createVendorFaq(input);
  if (result.ok) revalidatePath("/vendor/profile");
  return result;
}

export async function updateVendorFaqAction(id: string, input: VendorFaqInput): Promise<VendorActionResult> {
  const result = await updateVendorFaq(id, input);
  if (result.ok) revalidatePath("/vendor/profile");
  return result;
}

export async function deleteVendorFaqAction(id: string): Promise<VendorActionResult> {
  const result = await deleteVendorFaq(id);
  if (result.ok) revalidatePath("/vendor/profile");
  return result;
}
