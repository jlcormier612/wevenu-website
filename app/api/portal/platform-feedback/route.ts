import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    token?: string;
    npsScore?: number;
    comments?: string;
    suggestions?: string;
  };

  const { token, npsScore, comments, suggestions } = body;

  if (!token) {
    return NextResponse.json({ ok: false, error: "missing_token" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_wevenu_feedback", {
    p_token:       token,
    p_nps_score:   npsScore   ?? null,
    p_comments:    comments   ?? "",
    p_suggestions: suggestions ?? "",
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const result = data as { ok: boolean } | null;

  return NextResponse.json({ ok: result?.ok ?? false });
}
