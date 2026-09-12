import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import { seatingRpcHttpResult } from "@/lib/seating/http-result";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const floorPlanId = url.searchParams.get("floorPlanId");
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });
  if (!floorPlanId) {
    return NextResponse.json({ error: "floor_plan_required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_seating_data", {
    p_token: token,
    p_floor_plan_id: floorPlanId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const result = seatingRpcHttpResult(data);
  return NextResponse.json(result.body, { status: result.status });
}
