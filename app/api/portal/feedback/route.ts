import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    token?: string;
    rating?: number;
    lovedMost?: string;
    couldImprove?: string;
    wouldRecommend?: boolean;
    permission?: string;
  };

  const { token, rating, lovedMost, couldImprove, wouldRecommend, permission } = body;

  if (!token || typeof rating !== "number") {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_venue_feedback", {
    p_token:           token,
    p_rating:          rating,
    p_loved_most:      lovedMost  ?? "",
    p_could_improve:   couldImprove ?? "",
    p_would_recommend: wouldRecommend ?? true,
    p_permission:      permission  ?? "none",
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const result = data as { ok: boolean; error?: string } | null;
  if (!result?.ok) {
    return NextResponse.json({ ok: false, error: result?.error ?? "unknown" }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
