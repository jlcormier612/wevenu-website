import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

// Event-scoped vendor recommendations — replaces the old venue-wide,
// read-only vendor list (Vendor Management — Next Iteration, 2026-07-10).
//
// Commitment Alignment Sprint (docs/commitment-lifecycle-architecture.md
// §9): picking a vendor is now private (toggle_vendor_pick) — the venue
// sees nothing until the couple explicitly submits their list
// (/api/portal/vendors/submit). This route previously called
// triggerAutoComplete via a raw client_portal_sessions table select, which
// RLS silently blocked for real anonymous portal requests (no anon grant
// exists on that table) — task completion now happens natively inside
// submit_vendor_list instead, avoiding that whole bug class.

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const clientId = url.searchParams.get("clientId") ?? "";
  if (!token || !clientId) return NextResponse.json({ error: "missing_token" }, { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_event_vendor_recommendations", { p_access_token: token, p_client_id: clientId });
  return NextResponse.json(data ?? { recommendations: [] });
}

export async function POST(request: Request) {
  const body = await request.json() as { token?: string; clientId?: string; recommendationId?: string; picked?: boolean };
  const { token, clientId, recommendationId, picked } = body;
  if (!token || !clientId || !recommendationId || picked === undefined) {
    return NextResponse.json({ ok: false, error: "Missing fields." }, { status: 400 });
  }
  const supabase = await createClient();
  const { data } = await supabase.rpc("toggle_vendor_pick", {
    p_access_token: token, p_client_id: clientId, p_recommendation_id: recommendationId, p_picked: picked,
  });
  return NextResponse.json(data ?? { ok: false });
}
