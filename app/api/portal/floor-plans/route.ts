import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

/** Phase 1 — list Floor Plans shared with the couple (layout view). */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_portal_floor_plans", { p_token: token });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const body = data as Record<string, unknown> | null;
  if (body && body.error) {
    return NextResponse.json({ error: body.error }, { status: 403 });
  }
  return NextResponse.json(body ?? { floorPlans: [], operationalFloorPlanId: null });
}
