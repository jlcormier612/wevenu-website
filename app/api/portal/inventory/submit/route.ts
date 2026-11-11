import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

/**
 * POST /api/portal/inventory/submit — freeze draft → submitted quantities.
 * Does NOT mutate Event Order or invoice. Venue Confirm is the apply boundary.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { token?: string };
  if (!body.token) {
    return NextResponse.json({ ok: false, message: "Missing token." }, { status: 400 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_event_inventory_selections_for_portal", {
    p_token: body.token,
  });
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json(data ?? { ok: false });
}
