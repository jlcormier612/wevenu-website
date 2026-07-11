"use server";

import { revalidatePath } from "next/cache";

import { sendEmail } from "@/lib/email/send";
import { buildVendorInviteHtml, buildVendorInviteText } from "@/lib/email/vendor-invite";
import { createClient } from "@/integrations/supabase/server";
import { createVendor, deleteVendor_, reactivateVendor_ } from "@/lib/vendors/service";
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

  const supabase = await createClient();

  // Read vendor including claim_token (visible to venue owner via RLS)
  const { data: vendor, error: vErr } = await supabase
    .from("vendors")
    .select("id, business_name, email, claim_token, is_claimed")
    .eq("id", vendorId)
    .maybeSingle();

  if (vErr || !vendor) return { ok: false, message: "Vendor not found." };
  if (vendor.is_claimed) return { ok: false, message: "This vendor has already claimed their profile." };
  if (!vendor.email) return { ok: false, message: "Vendor has no email address. Add one first." };
  if (!vendor.claim_token) return { ok: false, message: "No claim token available for this vendor." };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.wevenu.com";
  const acceptUrl = `${appUrl}/vendor/accept?token=${vendor.claim_token}`;

  // Record the invitation
  await supabase.from("vendor_invitations").upsert(
    {
      venue_id:  venue.id,
      vendor_id: vendorId,
      email:     vendor.email,
      token:     vendor.claim_token,
      status:    "pending",
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    { onConflict: "token" },
  );

  const result = await sendEmail({
    to:      vendor.email,
    subject: `You're invited to manage ${vendor.business_name} on Wevenu`,
    text:    buildVendorInviteText({ vendorName: vendor.business_name, venueName: venue.name, acceptUrl }),
    html:    buildVendorInviteHtml({ vendorName: vendor.business_name, venueName: venue.name, acceptUrl }),
  });

  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, method: result.method };
}
