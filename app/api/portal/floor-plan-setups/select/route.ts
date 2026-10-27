import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

/** Phase 3 — preference within one setup only. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    token?: string;
    setupId?: string;
    floorPlanId?: string;
  } | null;
  const token = body?.token?.trim() ?? "";
  const setupId = body?.setupId?.trim() ?? "";
  const floorPlanId = body?.floorPlanId?.trim() ?? "";
  if (!token || !setupId || !floorPlanId) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("select_portal_setup_floor_plan_preference", {
    p_token: token,
    p_setup_id: setupId,
    p_floor_plan_id: floorPlanId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const result = data as Record<string, unknown> | null;
  if (result && result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result ?? { ok: true });
}
