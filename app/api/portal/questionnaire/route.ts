import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

/**
 * GET /api/portal/questionnaire — returns all open/submitted family forms for
 * the portal event (Client Planning, Final Details, Post-Event Feedback).
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_questionnaire_for_portal", { p_token: token });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = data ?? [];
  return NextResponse.json({
    questionnaires: rows,
    // Back-compat: prefer Final Details, else first open form.
    questionnaire: rows.find((r: { kind?: string }) => r.kind === "final_details") ?? rows[0] ?? null,
  });
}
