import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

// The couple's Commitment Lifecycle Submit event for one floor plan —
// creates an immutable seating_submissions snapshot and auto-completes the
// "Submit your seating plan" Playbook task as a side effect.
export async function POST(request: Request) {
  const { token, floorPlanId } = await request.json() as { token?: string; floorPlanId?: string };
  if (!token || !floorPlanId) {
    return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_seating_plan", { p_token: token, p_floor_plan_id: floorPlanId });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { ok: false });
}
