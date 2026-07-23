"use server";

import { revalidatePath } from "next/cache";

import { createVendor, deleteVendor_, reactivateVendor_ } from "@/lib/vendors/service";
import { sendVendorInvite } from "@/lib/vendor-invites/service";
import { getCurrentVenue } from "@/lib/venue/service";
import type { CreateVendorResult, VendorActionResult, VendorInput } from "@/lib/vendors/types";

export async function createVendorAction(input: VendorInput): Promise<CreateVendorResult> {
  const result = await createVendor(input);
  if (result.ok) revalidatePath("/vendors");
  return result;
}

export async function deleteVendorAction(vendorId: string): Promise<VendorActionResult> {
  const result = await deleteVendor_(vendorId);
  if (result.ok) { revalidatePath("/vendors"); revalidatePath(`/vendors/${vendorId}`); }
  return result;
}

export async function reactivateVendorAction(vendorId: string): Promise<VendorActionResult> {
  const result = await reactivateVendor_(vendorId);
  if (result.ok) { revalidatePath("/vendors"); revalidatePath(`/vendors/${vendorId}`); }
  return result;
}

export async function sendVendorInviteAction(vendorId: string): Promise<VendorActionResult & { method?: string }> {
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Session expired." };
  return sendVendorInvite(venue.id, venue.name, vendorId);
}
