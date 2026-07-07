/**
 * Vendor authentication service. Server-only.
 *
 * Provides the vendor-side equivalent of getCurrentVenue():
 *   - getVendorUser()        — returns the authenticated vendor user context
 *   - claimVendorProfile()   — claims a vendor profile via claim_token
 *   - getActorContext()      — resolves actor type for routing
 */
import { createClient } from "@/integrations/supabase/server";
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

  // Fire engagement event — look up the venue that invited this vendor
  if (result.vendor_id) {
    const supabase2 = await createClient();
    const { data: invite } = await supabase2
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
