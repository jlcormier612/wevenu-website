import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

// Delegation-gated venue writes (Commitment Lifecycle Architecture §7) —
// assign_guest_to_table_as_venue/remove_guest_assignment_as_venue check
// current_user_venue_id() plus an active seating_delegations row for the
// given floor plan; both reject otherwise.
export async function POST(request: Request) {
  const { floorPlanId, guestId, tableId } = await request.json();
  if (!floorPlanId || !guestId || !tableId) return NextResponse.json({ error: "missing_params" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("assign_guest_to_table_as_venue", {
    p_floor_plan_id: floorPlanId, p_guest_id: guestId, p_table_id: tableId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: data });
}

export async function DELETE(request: Request) {
  const { floorPlanId, guestId } = await request.json();
  if (!floorPlanId || !guestId) return NextResponse.json({ error: "missing_params" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("remove_guest_assignment_as_venue", {
    p_floor_plan_id: floorPlanId, p_guest_id: guestId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: data });
}
