import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

// The couple's Commitment Lifecycle Submit event for vendor selections —
// syncs the venue-visible selected_at state to match the couple's current
// private picks, creates an immutable vendor_selection_submissions
// snapshot, and auto-completes the "Choose your vendors" Playbook task as
// a side effect.
export async function POST(request: Request) {
  const { token, clientId } = await request.json() as { token?: string; clientId?: string };
  if (!token || !clientId) return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_vendor_list", { p_access_token: token, p_client_id: clientId });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { ok: false });
}
