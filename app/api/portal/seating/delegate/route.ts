import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

// Commitment Lifecycle Architecture §7 — Delegation: explicit, scoped to
// one floor plan, revocable, visible to both parties. POST grants (couple
// hands seating management to the venue); DELETE revokes.
export async function POST(request: Request) {
  const { token, floorPlanId, note } = await request.json() as { token?: string; floorPlanId?: string; note?: string };
  if (!token || !floorPlanId) {
    return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("grant_seating_delegation", {
    p_token: token, p_floor_plan_id: floorPlanId, p_note: note ?? null,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { ok: false });
}

export async function DELETE(request: Request) {
  const { token, delegationId } = await request.json() as { token?: string; delegationId?: string };
  if (!token || !delegationId) {
    return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("revoke_seating_delegation", {
    p_token: token, p_delegation_id: delegationId,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { ok: false });
}
