import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

/**
 * Portal: venue furniture catalog + remaining quantities for the shared working plan.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim() ?? "";
  const floorPlanId = url.searchParams.get("floorPlanId")?.trim() ?? "";
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });
  if (!floorPlanId) return NextResponse.json({ error: "missing_floor_plan_id" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_portal_floor_plan_furniture_catalog", {
    p_token: token,
    p_floor_plan_id: floorPlanId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const result = data as { error?: string } | null;
  if (result?.error) {
    const code = result.error;
    const status =
      code === "insufficient_access" || code === "invalid_token" ? 403
        : code === "not_found_or_not_shared" ? 404
          : 400;
    return NextResponse.json({ error: code }, { status });
  }
  return NextResponse.json(result);
}
