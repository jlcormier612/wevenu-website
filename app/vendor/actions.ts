"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { updateVendorProfile, updateVendorLogo, markVendorLuvIntroSeen } from "@/lib/vendor-profile/service";
import { claimVendorProfile, createVendorAccountAndClaim } from "@/lib/vendor-auth/service";
import { getVendorActiveVenue, updateVenuePromotion } from "@/lib/vendor-partnerships/service";
import type { VendorActionResult, VendorActiveVenueContext, VendorProfileInput } from "@/lib/vendors/types";

/** Form state for vendor accept signup — type-only export (no runtime value). */
export type VendorAcceptFormState = { error?: string };

function validateVendorSignupPassword(password: string, confirm: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password !== confirm) return "Passwords do not match.";
  return null;
}

export async function createVendorAccountAndClaimAction(
  _prevState: VendorAcceptFormState,
  formData: FormData,
): Promise<VendorAcceptFormState> {
  const token = String(formData.get("token") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!token) return { error: "This invitation link is missing a token." };

  const passwordError = validateVendorSignupPassword(password, confirm);
  if (passwordError) return { error: passwordError };

  const result = await createVendorAccountAndClaim(token, email, password);
  if (!result.ok) {
    // Auth succeeded but claim did not — land on accept so Claim button can finish.
    if (result.signedIn) {
      redirect(`/vendor/accept?token=${encodeURIComponent(token)}`);
    }
    return { error: result.message };
  }

  revalidatePath("/vendor", "layout");
  redirect("/vendor/dashboard");
}

export async function updateVendorProfileAction(input: VendorProfileInput): Promise<VendorActionResult> {
  if (!input.businessName.trim()) return { ok: false, errors: { businessName: "Business name is required." } };
  if (!input.category.trim()) return { ok: false, errors: { category: "Category is required." } };
  if (!input.contactName.trim()) return { ok: false, errors: { contactName: "Contact name is required." } };
  if (!input.email.trim()) return { ok: false, errors: { email: "Email is required." } };
  if (!input.websiteUrl.trim()) return { ok: false, errors: { websiteUrl: "Website is required." } };
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
  revalidatePath("/vendor/luv");
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
