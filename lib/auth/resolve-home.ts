/**
 * Server helpers: resolve which portals are active in this browser.
 *
 * Venue / vendor / client use separate cookie jars, so roles are loaded from
 * each scope's signed-in user independently.
 */
import {
  createClient,
  createClientPortalAuthClient,
  createVendorClient,
} from "@/integrations/supabase/server";
import {
  pickAuthenticatedHomePath,
  type PortalKind,
  type PortalRoles,
} from "@/lib/auth/portal-home";

export type ActivePortalSessions = {
  venue: { userId: string; email: string | null; roles: PortalRoles } | null;
  vendor: { userId: string; email: string | null; roles: PortalRoles } | null;
  client: { userId: string; email: string | null; roles: PortalRoles } | null;
};

async function rolesForUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
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
      .maybeSingle(),
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

/** Load portal capability for a single scoped session (legacy callers). */
export async function loadPortalRoles(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
): Promise<PortalRoles> {
  return rolesForUser(supabase, userId);
}

/**
 * Snapshot of every portal session currently living in this browser's cookies.
 */
export async function loadActivePortalSessions(): Promise<ActivePortalSessions> {
  const [venueSb, vendorSb, clientSb] = await Promise.all([
    createClient("venue"),
    createVendorClient(),
    createClientPortalAuthClient(),
  ]);

  const [venueAuth, vendorAuth, clientAuth] = await Promise.all([
    venueSb.auth.getUser(),
    vendorSb.auth.getUser(),
    clientSb.auth.getUser(),
  ]);

  const venueUser = venueAuth.data.user;
  const vendorUser = vendorAuth.data.user;
  const clientUser = clientAuth.data.user;

  const [venueRoles, vendorRoles, clientRoles] = await Promise.all([
    venueUser ? rolesForUser(venueSb, venueUser.id) : null,
    vendorUser ? rolesForUser(vendorSb, vendorUser.id) : null,
    clientUser ? rolesForUser(clientSb, clientUser.id) : null,
  ]);

  return {
    venue: venueUser && venueRoles
      ? {
          userId: venueUser.id,
          email: venueUser.email ?? null,
          roles: venueRoles,
        }
      : null,
    vendor: vendorUser && vendorRoles
      ? {
          userId: vendorUser.id,
          email: vendorUser.email ?? null,
          roles: vendorRoles,
        }
      : null,
    client: clientUser && clientRoles
      ? {
          userId: clientUser.id,
          email: clientUser.email ?? null,
          roles: clientRoles,
        }
      : null,
  };
}

/**
 * Post-login home for the venue cookie jar (used by `/login` + venue signIn).
 * Vendor/client logins use their own actions and never call this.
 */
export async function resolveAuthenticatedHomePath(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  options?: { next?: string | null; prefer?: PortalKind | null },
): Promise<string> {
  const roles = await loadPortalRoles(supabase, userId);
  // Venue login should land in venue context when the identity is venue staff,
  // even if the same auth user also has vendor/client rows historically linked.
  const prefer =
    options?.prefer ??
    (roles.isVenueStaff ? ("venue" as const) : null);
  return pickAuthenticatedHomePath({
    next: options?.next,
    roles,
    prefer,
  });
}

export type { PortalRoles, PortalKind };
