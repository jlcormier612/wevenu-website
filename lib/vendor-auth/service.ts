/**
 * Vendor authentication service. Server-only.
 *
 * Provides the vendor-side equivalent of getCurrentVenue():
 *   - getVendorUser()        — returns the authenticated vendor user context
 *   - claimVendorProfile()   — claims a vendor profile via claim_token
 *   - getActorContext()      — resolves actor type for routing
 */
import { createVendorClient as createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { recordEngagementEvent } from "@/lib/activation/service";
import type { ActorContext, VendorRole } from "@/lib/vendors/types";

export type VendorUserContext = {
  vendorId: string;
  userId:   string;
  role:     VendorRole;
};

export async function getVendorUser(): Promise<VendorUserContext | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("vendor_users")
    .select("vendor_id, user_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!data) return null;
  return { vendorId: data.vendor_id, userId: data.user_id, role: data.role as VendorRole };
}

/**
 * Create a Supabase auth user for an invited vendor and sign them in.
 * Mirrors the client-invite path (admin.createUser + signInWithPassword):
 * product `/login` has no signup, so invitees create accounts here.
 */
async function createAndSignInVendorAccount(
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = createAdminClient();
  const { error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr && !createErr.message.toLowerCase().includes("already been registered")) {
    return { ok: false, message: createErr.message };
  }

  const supabase = await createClient();
  const {
    data: { user: existing },
  } = await supabase.auth.getUser();
  if (
    existing?.email &&
    existing.email.trim().toLowerCase() !== email.trim().toLowerCase()
  ) {
    await supabase.auth.signOut();
  }

  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
  if (signInErr) {
    return {
      ok: false,
      message: createErr
        ? "An account with this email already exists. Please sign in instead."
        : signInErr.message,
    };
  }
  return { ok: true };
}

export type CreateVendorAccountResult =
  | { ok: true; vendorId: string }
  | { ok: false; message: string; signedIn?: boolean };

/**
 * Invite accept create-account path: validate email against the pending
 * invitation (when present), create/sign-in, then claim the vendor profile.
 */
export async function createVendorAccountAndClaim(
  claimToken: string,
  email: string,
  password: string,
): Promise<CreateVendorAccountResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return { ok: false, message: "Enter a valid email address." };
  }
  if (password.length < 8) {
    return { ok: false, message: "Password must be at least 8 characters." };
  }

  // Prefer invitation email when the invite row is still pending — keep the
  // claimed account tied to the address the venue invited.
  const supabase = await createClient();
  const { data: preview } = await supabase.rpc("get_invitation_preview", { p_token: claimToken });
  const inviteEmail =
    preview && typeof preview === "object" && "email" in preview
      ? String((preview as { email?: string }).email ?? "").trim().toLowerCase()
      : "";
  if (inviteEmail && inviteEmail !== normalizedEmail) {
    return {
      ok: false,
      message: "Use the email address this invitation was sent to.",
    };
  }

  const signedIn = await createAndSignInVendorAccount(normalizedEmail, password);
  if (!signedIn.ok) return signedIn;

  const claimed = await claimVendorProfile(claimToken);
  if (!claimed.ok) {
    // Session is live — accept page Claim button can finish the job.
    return { ok: false, message: claimed.message, signedIn: true };
  }

  return { ok: true, vendorId: claimed.vendorId };
}

export async function claimVendorProfile(claimToken: string): Promise<
  { ok: true; vendorId: string; alreadyVendor: boolean } | { ok: false; message: string }
> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_vendor_profile", {
    p_claim_token: claimToken,
    p_role:        "owner",
  });
  if (error) return { ok: false, message: error.message };

  const result = data as { ok: boolean; vendor_id?: string; already_vendor?: boolean; error?: string };
  if (!result.ok) return { ok: false, message: result.error ?? "Could not claim profile." };

  // Fire engagement event — look up the venue that invited this vendor.
  // vendor_invitations' RLS only recognizes the inviting venue's owner
  // (venues_manage_invitations) or HQ — a freshly-claimed vendor session
  // has no read access to its own invitation row. Confirmed live: this
  // silently returned nothing under a real vendor session, silently
  // dropping the "vendor.invitation_accepted" engagement event on every
  // claim (no user-facing error, since the read result is only used inside
  // an `if`). Uses the admin client for this one internal lookup, the same
  // sanctioned pattern lib/contracts/service.ts's signContractByToken uses
  // for "the caller has no venue_staff session yet" reads.
  //
  // Also idempotently marks any still-pending invitations accepted. The
  // claim_vendor_profile RPC already does this (20260723), but a venue
  // must never keep seeing "pending" after a successful claim — so the
  // TypeScript path re-asserts the fact under admin when the RPC side
  // is somehow stale or skipped.
  if (result.vendor_id) {
    const admin = createAdminClient();
    await admin
      .from("vendor_invitations")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("vendor_id", result.vendor_id)
      .eq("status", "pending");

    const { data: invite } = await admin
      .from("vendor_invitations")
      .select("venue_id")
      .eq("vendor_id", result.vendor_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ venue_id: string }>();
    if (invite?.venue_id) {
      void recordEngagementEvent({
        venueId:   invite.venue_id,
        eventType: "vendor.invitation_accepted",
        actorType: "vendor",
        entityType: "vendor",
        entityId:  result.vendor_id,
      });
    }
  }

  return { ok: true, vendorId: result.vendor_id!, alreadyVendor: result.already_vendor ?? false };
}

export async function getActorContext(): Promise<ActorContext> {
  if (!isSupabaseConfigured) return { actor_type: "unknown" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_actor_context");
  if (error || !data) return { actor_type: "unknown" };
  return data as ActorContext;
}
