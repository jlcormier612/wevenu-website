/**
 * Resolve real customer-facing portal destinations for HTC support enter.
 * Client → /p/{access_token}; vendor → /vendor/dashboard.
 * Never redirects to venue staff /clients/[id] or /vendors/[id].
 */

type PortalSessionLookup = {
  data: { access_token: string } | null;
  error: { message?: string } | null;
};

export async function resolveClientPortalPath(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- avoid deep Supabase generics
  admin: { from: (table: string) => any },
  opts: { clientId: string; venueId: string },
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const result = (await admin
    .from("client_portal_sessions")
    .select("access_token")
    .eq("client_id", opts.clientId)
    .eq("venue_id", opts.venueId)
    .or("expires_at.is.null,expires_at.gt.now()")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()) as PortalSessionLookup;

  const { data, error } = result;

  if (error) {
    return { ok: false, error: error.message || "portal_session_lookup_failed" };
  }
  if (!data?.access_token) {
    return {
      ok: false,
      error:
        "No client portal session exists for this client yet. Invite or open the portal from the venue first.",
    };
  }
  return { ok: true, path: `/p/${data.access_token}` };
}

export function resolveVendorPortalPath(): string {
  return "/vendor/dashboard";
}
