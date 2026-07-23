import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

/**
 * GET /api/portal/questionnaire — resolves the couple's own Final Details
 * questionnaire via their portal session, not the mailed access_key
 * (Client Collaboration Workspace, 2026-07-22: "the venue assigns a
 * Questionnaire → the client immediately sees and completes it"). Returns
 * the same row shape the standalone /questionnaire/[key] page already
 * uses, including access_key, so the couple can submit through the exact
 * same CoupleQuestionnaireForm + /api/public/questionnaire path unchanged.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_questionnaire_for_portal", { p_token: token });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ questionnaire: data?.[0] ?? null });
}
