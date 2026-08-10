import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

type Params = { params: Promise<{ offerId: string }> };

/** Phase 2 — read-only preview of an offered venue template. */
export async function GET(request: Request, { params }: Params) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const { offerId } = await params;
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });
  if (!offerId) return NextResponse.json({ error: "missing_offer_id" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_portal_floor_plan_offer_preview", {
    p_token: token,
    p_offer_id: offerId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const body = data as Record<string, unknown> | null;
  if (body && body.error) {
    const status = body.error === "not_found_or_not_offered" || body.error === "template_unavailable" ? 404 : 403;
    return NextResponse.json({ error: body.error }, { status });
  }
  return NextResponse.json(body);
}
