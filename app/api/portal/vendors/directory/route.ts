import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

// The venue's full preferred-vendor network (venue_vendor_relationships),
// live and always visible — not scoped to this couple's event, and
// nothing to submit/share. Sibling to /api/portal/vendors, which stays
// scoped to vendors a coordinator explicitly recommended for this event.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_venue_vendor_directory", { p_access_token: token });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { vendors: [] });
}
