import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

/**
 * Portal: auto-assign when exactly one eligible offer; heal share+seating
 * on an existing selection. Idempotent.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { token?: string } | null;
  const token = body?.token?.trim() ?? "";
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ensure_portal_floor_plan_assignment", {
    p_token: token,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const result = data as Record<string, unknown> | null;
  if (!result || result.error) {
    const code = (result?.error as string) ?? "ensure_failed";
    const status =
      code === "insufficient_access" || code === "invalid_token" ? 403
        : code === "not_found_or_not_offered" || code === "template_unavailable" ? 404
          : 400;
    return NextResponse.json({ error: code }, { status });
  }
  return NextResponse.json(result);
}
