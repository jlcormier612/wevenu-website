import { createClient } from "@/integrations/supabase/server";
import { venueFaviconResponse, faviconSize, faviconContentType } from "@/lib/venue-brand/favicon";

export const size = faviconSize;
export const contentType = faviconContentType;

export default async function Icon({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_questionnaire_for_couple", { p_key: key });
  const row = data?.[0];
  return venueFaviconResponse(row?.venue_logo_url ?? null);
}
