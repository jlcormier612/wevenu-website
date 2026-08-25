import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import { seatingRpcHttpResult } from "@/lib/seating/http-result";

// The venue's own Commitment Lifecycle Submit event while delegated — a
// checkpoint snapshot, same shape as the couple's own submit_seating_plan.
export async function POST(request: Request) {
  const { floorPlanId } = await request.json();
  if (!floorPlanId) return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_seating_plan_as_venue", { p_floor_plan_id: floorPlanId });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const result = seatingRpcHttpResult(data);
  return NextResponse.json(result.body, { status: result.status });
}
