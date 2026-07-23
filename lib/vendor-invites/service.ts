import { createClient } from "@/integrations/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { buildVendorInviteHtml, buildVendorInviteText } from "@/lib/email/vendor-invite";
import type { VendorActionResult } from "@/lib/vendors/types";

/**
 * The invite send, factored out of the manual "Send Invite" button
 * (app/(app)/vendors/actions.ts) so Stage 3 lifecycle automation (Vendor
 * Workspace Realignment, Phase 3, 2026-07-22) can call the exact same path
 * automatically: "when a vendor is selected by the couple, automatically
 * ... invite vendor into Hello to Cheers." A vendor booked onto a real
 * event with no portal login would otherwise have no way to see their
 * assignment, tasks, or timeline — this closes that gap without requiring
 * the venue to remember a separate manual step.
 */
export async function sendVendorInvite(
  venueId: string, venueName: string, vendorId: string,
): Promise<VendorActionResult & { method?: string }> {
  const supabase = await createClient();

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

  await supabase.from("vendor_invitations").upsert(
    {
      venue_id: venueId,
      vendor_id: vendorId,
      email: vendor.email,
      token: vendor.claim_token,
      status: "pending",
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    { onConflict: "token" },
  );

  const result = await sendEmail({
    to: vendor.email,
    subject: `You're invited to manage ${vendor.business_name} on Hello to Cheers`,
    text: buildVendorInviteText({ vendorName: vendor.business_name, venueName, acceptUrl }),
    html: buildVendorInviteHtml({ vendorName: vendor.business_name, venueName, acceptUrl }),
  });

  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, method: result.method };
}

/**
 * Fire-and-forget wrapper for automatic invite triggers (assignment,
 * future recommendation-contact) — never lets an invite failure (no email
 * on file, send provider down, already claimed) block or fail the
 * booking/action that triggered it. The manual "Send Invite" button still
 * uses sendVendorInvite() directly so a coordinator sees the real error.
 */
export async function autoInviteVendorIfUnclaimed(venueId: string, venueName: string, vendorId: string): Promise<void> {
  try {
    await sendVendorInvite(venueId, venueName, vendorId);
  } catch {
    // best-effort — booking must still succeed even if the invite email fails
  }
}
