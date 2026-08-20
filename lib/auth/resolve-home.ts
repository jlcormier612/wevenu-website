/**
 * Server helpers: resolve which portals the current auth user can enter.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  pickAuthenticatedHomePath,
  type PortalKind,
  type PortalRoles,
} from "@/lib/auth/portal-home";

type AuthedClient = SupabaseClient;

export async function loadPortalRoles(
  supabase: AuthedClient,
  userId: string,
): Promise<PortalRoles> {
  const [vendorRes, clientRes, venueIdRes] = await Promise.all([
    supabase
      .from("vendor_users")
      .select("vendor_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("client_portal_sessions")
      .select("access_token")
      .eq("client_user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ access_token: string }>(),
    supabase.rpc("current_user_venue_id"),
  ]);

  return {
    isVendor: Boolean(vendorRes.data?.vendor_id),
    clientPortalPath: clientRes.data?.access_token
      ? `/p/${clientRes.data.access_token}`
      : null,
    isVenueStaff: Boolean(venueIdRes.data),
  };
}

export async function resolveAuthenticatedHomePath(
  supabase: AuthedClient,
  userId: string,
  options?: { next?: string | null; prefer?: PortalKind | null },
): Promise<string> {
  const roles = await loadPortalRoles(supabase, userId);
  return pickAuthenticatedHomePath({
    next: options?.next,
    roles,
    prefer: options?.prefer,
  });
}

export type { PortalRoles, PortalKind };
