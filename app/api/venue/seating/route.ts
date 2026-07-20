import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

// Venue-authenticated read for one floor plan (current_user_venue_id(),
// no borrowed portal token) — returns the couple's live draft when this
// plan is actively delegated, or their latest Submitted snapshot
// otherwise. See lib/seating/service.ts's getOperationalSeatingPlan for
// the same logic used server-side on the read-only Wedding Day Seating page.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId");
  const floorPlanId = url.searchParams.get("floorPlanId");
  if (!eventId || !floorPlanId) return NextResponse.json({ error: "missing_params" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_operational_seating_plan", {
    p_event_id: eventId, p_floor_plan_id: floorPlanId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? {});
}
