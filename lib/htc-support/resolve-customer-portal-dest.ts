/**
 * Resolve real customer-facing portal destinations for HTC support enter.
 * Client → /p/{access_token}; vendor → /vendor/dashboard.
 * Never redirects to venue staff /clients/[id] or /vendors/[id].
 */

type PortalSessionAdmin = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        eq: (col: string, val: string) => {
          or: (filter: string) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => {
              limit: (n: number) => {
                maybeSingle: <T>() => Promise<{
                  data: T | null;
                  error: { message?: string } | null;
                }>;
              };
            };
          };
        };
      };
    };
  };
};

export async function resolveClientPortalPath(
  admin: PortalSessionAdmin,
  opts: { clientId: string; venueId: string },
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const { data, error } = await admin
    .from("client_portal_sessions")
    .select("access_token")
    .eq("client_id", opts.clientId)
    .eq("venue_id", opts.venueId)
    .or("expires_at.is.null,expires_at.gt.now()")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ access_token: string }>();

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
