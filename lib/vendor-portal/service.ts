import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";
import type { VendorPortalContext } from "@/lib/vendor-portal/types";

export async function resolveVendorPortalContext(token: string): Promise<VendorPortalContext | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_vendor_portal_context", { p_token: token });
  if (error || !data || (data as Record<string, unknown>).error) return null;
  return data as VendorPortalContext;
}

export async function getVendorPortalSessions(vendorId: string) {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("vendor_portal_sessions")
    .select("*")
    .eq("vendor_id", vendorId)
    .eq("venue_id", venue.id)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function createVendorPortalSession(vendorId: string, label: string) {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("vendor_portal_sessions")
    .insert({ vendor_id: vendorId, venue_id: venue.id, label, access_level: "full" })
    .select("access_token")
    .single<{ access_token: string }>();
  return data?.access_token ?? null;
}

export async function revokeVendorPortalSession(sessionId: string) {
  if (!isSupabaseConfigured) return;
  const venue = await getCurrentVenue();
  if (!venue) return;
  const supabase = await createClient();
  await supabase.from("vendor_portal_sessions").delete().eq("id", sessionId).eq("venue_id", venue.id);
}
