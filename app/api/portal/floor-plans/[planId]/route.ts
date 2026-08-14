import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

/** Phase 1 — one shared Floor Plan + all objects (view-only). */
export async function GET(
  request: Request,
  context: { params: Promise<{ planId: string }> },
) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const { planId } = await context.params;
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });
  if (!planId) return NextResponse.json({ error: "missing_plan_id" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_portal_floor_plan", {
    p_token: token,
    p_floor_plan_id: planId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const body = data as Record<string, unknown> | null;
  if (body && body.error) {
    const status = body.error === "insufficient_access" ? 403 : 404;
    return NextResponse.json({ error: body.error }, { status });
  }
  return NextResponse.json(body);
}
