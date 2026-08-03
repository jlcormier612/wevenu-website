"use server";

import { revalidatePath } from "next/cache";

import { updateVendorProfile, updateVendorLogo, markVendorLuvIntroSeen } from "@/lib/vendor-profile/service";
import { claimVendorProfile } from "@/lib/vendor-auth/service";
import { getVendorActiveVenue, updateVenuePromotion } from "@/lib/vendor-partnerships/service";
import type { VendorActionResult, VendorActiveVenueContext, VendorProfileInput } from "@/lib/vendors/types";

export async function updateVendorProfileAction(input: VendorProfileInput): Promise<VendorActionResult> {
  if (!input.businessName.trim()) return { ok: false, errors: { businessName: "Business name is required." } };
  const result = await updateVendorProfile(input);
  if (result.ok) revalidatePath("/vendor/profile");
  return result;
}

// Saves immediately on upload — not staged in the Profile form's local
// state — so it persists even if the vendor never clicks "Save Profile."
// Also refreshes the sidebar (/vendor layout), which reads the logo too.
export async function updateVendorLogoAction(url: string | null): Promise<VendorActionResult> {
  const result = await updateVendorLogo(url);
  if (result.ok) {
    revalidatePath("/vendor/profile");
    revalidatePath("/vendor", "layout");
  }
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

// Venue-First Dashboard's lightweight switcher (2026-07-24) — only rendered
// when a vendor has more than one active venue relationship. Re-resolves
// the hero/contacts/partnership block client-side without a full page nav.
export async function getVendorActiveVenueAction(venueId: string): Promise<VendorActiveVenueContext> {
  return getVendorActiveVenue(venueId);
}

export async function updateVenuePromotionAction(
  relationshipId: string, headline: string, details: string,
): Promise<VendorActionResult> {
  const result = await updateVenuePromotion(relationshipId, headline, details);
  if (result.ok) {
    revalidatePath("/vendor/partnerships");
    // The promotion also renders on the venue-first Dashboard now.
    revalidatePath("/vendor/dashboard");
  }
  return result;
}
