import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import { projectGuideForAudience, type VenueGuideRaw } from "@/lib/venue-guide/audience";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_venue_info_for_portal", { p_token: token });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json(null);

  const projected = projectGuideForAudience(data as VenueGuideRaw, "clients");
  if (!projected) return NextResponse.json(null);

  // Couple portal UI only needs audience-resolved fields (no vendor overrides).
  const { parkingUsesVendorOverride: _flag, ...payload } = projected;
  void _flag;
  return NextResponse.json(payload);
}
