import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_portal_post_wedding_status", { p_token: token });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const result = data as {
    feedbackSubmitted?: boolean;
    feedbackRating?:    number;
    referralSubmitted?: boolean;
    memoriesCount?: number;
    error?: string;
  } | null;

  if (result?.error) return NextResponse.json({ error: result.error }, { status: 401 });

  return NextResponse.json({
    feedbackSubmitted: result?.feedbackSubmitted ?? false,
    feedbackRating:    result?.feedbackRating    ?? 0,
    referralSubmitted: result?.referralSubmitted ?? false,
    memoriesCount:     result?.memoriesCount     ?? 0,
  });
}
