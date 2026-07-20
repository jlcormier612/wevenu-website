"use server";

import { revalidatePath } from "next/cache";

import { updateVendorProfile, markVendorLuvIntroSeen } from "@/lib/vendor-profile/service";
import { claimVendorProfile } from "@/lib/vendor-auth/service";
import type { VendorActionResult, VendorProfileInput } from "@/lib/vendors/types";

export async function updateVendorProfileAction(input: VendorProfileInput): Promise<VendorActionResult> {
  if (!input.businessName.trim()) return { ok: false, errors: { businessName: "Business name is required." } };
  const result = await updateVendorProfile(input);
  if (result.ok) revalidatePath("/vendor/profile");
  return result;
}

/** Luv Experience Completion, Work Stream 5 — dismiss the one-time intro card. */
export async function markVendorLuvIntroSeenAction(): Promise<void> {
  await markVendorLuvIntroSeen();
  revalidatePath("/vendor/dashboard");
}

export async function claimVendorProfileAction(claimToken: string): Promise<
  { ok: true; vendorId: string; alreadyVendor: boolean } | { ok: false; message: string }
> {
  return claimVendorProfile(claimToken);
}
