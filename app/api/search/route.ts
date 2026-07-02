import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json({ results: [] });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_global", {
    p_query: q.trim(),
    p_limit: 5,
  });

  if (error) return NextResponse.json({ results: [], error: error.message }, { status: 500 });

  const result = data as { results?: unknown[]; error?: string } | null;
  if (result?.error) return NextResponse.json({ results: [], error: result.error }, { status: 401 });

  return NextResponse.json({ results: result?.results ?? [] });
}
