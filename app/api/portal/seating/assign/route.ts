import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import { seatingRpcHttpResult } from "@/lib/seating/http-result";

export async function POST(request: Request) {
  const { token, guestId, tableId, floorPlanId } = await request.json();
  if (!token || !guestId || !tableId || !floorPlanId) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("assign_guest_to_table", {
    p_token: token,
    p_guest_id: guestId,
    p_table_id: tableId,
    p_floor_plan_id: floorPlanId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const result = seatingRpcHttpResult(data);
  return NextResponse.json(result.body, { status: result.status });
}

export async function DELETE(request: Request) {
  const { token, guestId, floorPlanId } = await request.json();
  if (!token || !guestId || !floorPlanId) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("remove_guest_assignment", {
    p_token: token,
    p_guest_id: guestId,
    p_floor_plan_id: floorPlanId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const result = seatingRpcHttpResult(data);
  return NextResponse.json(result.body, { status: result.status });
}
