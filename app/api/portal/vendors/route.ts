import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import { triggerAutoComplete } from "@/lib/playbooks/service";

// Event-scoped vendor recommendations — replaces the old venue-wide,
// read-only vendor list (Vendor Management — Next Iteration, 2026-07-10).
// A couple only ever sees what their venue specifically recommended to
// them, and can select one, which the venue sees immediately.

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
  const body = await request.json() as { token?: string; clientId?: string; recommendationId?: string };
  const { token, clientId, recommendationId } = body;
  if (!token || !clientId || !recommendationId) {
    return NextResponse.json({ ok: false, error: "Missing fields." }, { status: 400 });
  }
  const supabase = await createClient();
  const { data } = await supabase.rpc("select_event_vendor_recommendation", {
    p_access_token: token, p_client_id: clientId, p_recommendation_id: recommendationId,
  });

  // Auto-complete any Planning task waiting on a vendor selection (e.g.
  // "Choose a florist") — same mechanism as contract_signed/payment_received,
  // just triggered from the couple's own action rather than the venue's.
  if ((data as { ok?: boolean } | null)?.ok) {
    const { data: session } = await supabase
      .from("client_portal_sessions")
      .select("venue_id, client_id")
      .eq("access_token", token)
      .maybeSingle<{ venue_id: string; client_id: string }>();
    if (session) {
      const { data: event } = await supabase
        .from("events")
        .select("id")
        .eq("client_id", session.client_id).eq("venue_id", session.venue_id)
        .not("status", "in", "(cancelled,complete)")
        .order("event_date").limit(1)
        .maybeSingle<{ id: string }>();
      if (event) {
        await triggerAutoComplete(supabase, session.venue_id, event.id, "vendor_selected", "vendor_recommendation", recommendationId);
      }
    }
  }

  return NextResponse.json(data ?? { ok: false });
}
