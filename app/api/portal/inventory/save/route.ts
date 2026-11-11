import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

/** POST /api/portal/inventory/save — persist draft quantities (not a submission). */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    token?: string;
    selections?: Array<{ itemId: string; quantity: number }>;
  };
  if (!body.token) {
    return NextResponse.json({ ok: false, message: "Missing token." }, { status: 400 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_event_inventory_selections_for_portal", {
    p_token: body.token,
    p_selections: body.selections ?? [],
  });
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json(data ?? { ok: true });
}
