import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

/**
 * Portal: add a permitted table on the shared working plan when
 * couple_may_add_tables is true and the plan is not Ready.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    token?: string;
    floorPlanId?: string;
    objectType?: string;
    x?: number;
    y?: number;
  } | null;
  const token = body?.token?.trim() ?? "";
  const floorPlanId = body?.floorPlanId?.trim() ?? "";
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });
  if (!floorPlanId) return NextResponse.json({ error: "missing_floor_plan_id" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_portal_floor_plan_table", {
    p_token: token,
    p_floor_plan_id: floorPlanId,
    p_object_type: body?.objectType ?? "table_round",
    p_x: typeof body?.x === "number" ? body.x : 200,
    p_y: typeof body?.y === "number" ? body.y : 200,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    const code = result?.error ?? "add_failed";
    const status =
      code === "add_not_permitted" || code === "plan_ready" || code === "type_not_permitted" ? 403
        : code === "not_shared" ? 404
          : code === "insufficient_access" || code === "invalid_token" ? 403
            : 400;
    return NextResponse.json({ error: code }, { status });
  }
  return NextResponse.json(result);
}
