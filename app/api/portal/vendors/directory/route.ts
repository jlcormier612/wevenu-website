import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

// The venue's full preferred-vendor network (venue_vendor_relationships),
// with this couple's pick / selection / assignment state overlaid so
// directory cards can select like Recommended for You.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const clientId = url.searchParams.get("clientId") ?? "";
  if (!token || !clientId) return NextResponse.json({ error: "missing_params" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_venue_vendor_directory", {
    p_access_token: token,
    p_client_id: clientId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const payload = (data ?? { vendors: [] }) as { vendors?: Array<{ vendorId?: string }>; error?: string };
  if (payload.error) return NextResponse.json(payload);
  const { overlayCoupleVendorAvailability } = await import("@/lib/vendor-availability/couple-overlay");
  const overlay = await overlayCoupleVendorAvailability(token, payload.vendors ?? []);
  return NextResponse.json({
    ...payload,
    eventDate: overlay.eventDate,
    vendors: overlay.items,
  });
}
