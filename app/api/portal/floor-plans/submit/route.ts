import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

/**
 * Portal: couple submits the selected working floor plan for venue review.
 * Idempotent when already submitted. Server-enforced status gates.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    token?: string;
    floorPlanId?: string;
  } | null;
  const token = body?.token?.trim() ?? "";
  const floorPlanId = body?.floorPlanId?.trim() ?? "";
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });
  if (!floorPlanId) return NextResponse.json({ error: "missing_floor_plan_id" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_portal_floor_plan", {
    p_token: token,
    p_floor_plan_id: floorPlanId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const result = data as {
    ok?: boolean;
    error?: string;
    alreadySubmitted?: boolean;
    clientLayoutStatus?: string;
    clientSubmittedAt?: string;
  } | null;
  if (!result?.ok) {
    const code = result?.error ?? "submit_failed";
    const status =
      code === "plan_ready" || code === "plan_approved" || code === "not_selected_layout" ? 403
        : code === "not_shared" ? 404
          : code === "insufficient_access" || code === "invalid_token" ? 403
            : 400;
    return NextResponse.json({ error: code }, { status });
  }
  return NextResponse.json(result);
}
