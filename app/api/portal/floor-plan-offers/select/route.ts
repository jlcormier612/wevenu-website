import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

/**
 * Couple selects an offered layout (Phase 2 preference only).
 * Clones or reuses the event plan; never mutates the Library template.
 * Sets couple_selected_floor_plan_id + couple_preference_status=pending.
 * Does not change operational_floor_plan_id, sharing, seating access, or assignments.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { token?: string; offerId?: string } | null;
  const token = body?.token?.trim() ?? "";
  const offerId = body?.offerId?.trim() ?? "";
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });
  if (!offerId) return NextResponse.json({ error: "missing_offer_id" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("select_portal_floor_plan_offer", {
    p_token: token,
    p_offer_id: offerId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const result = data as Record<string, unknown> | null;
  if (!result || result.error) {
    const code = (result?.error as string) ?? "select_failed";
    const status =
      code === "not_found_or_not_offered" || code === "template_unavailable" ? 404
        : code === "insufficient_access" || code === "invalid_token" ? 403
          : 400;
    return NextResponse.json({ error: code }, { status });
  }
  return NextResponse.json(result);
}
