import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

// The couple's floor-plan picker (Commitment Lifecycle Architecture §9 —
// each floor plan is an independent Commitment Lifecycle, e.g. Ceremony
// and Reception each have their own draft/submission/delegation).
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_seating_floor_plans", { p_token: token });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ floorPlans: data ?? [] });
}
