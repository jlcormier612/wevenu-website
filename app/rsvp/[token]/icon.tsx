import { createClient } from "@/integrations/supabase/server";
import { venueFaviconResponse, faviconSize, faviconContentType } from "@/lib/venue-brand/favicon";

export const size = faviconSize;
export const contentType = faviconContentType;

export default async function Icon({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_rsvp_context", { p_rsvp_token: token });
  const d = data as Record<string, unknown> | null;
  const venue = d?.venue as { logoUrl?: string | null } | undefined;
  return venueFaviconResponse(venue?.logoUrl ?? null);
}
