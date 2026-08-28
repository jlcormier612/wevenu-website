import { NextResponse } from "next/server";

import { createClient } from "@/integrations/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!key || !start || !end) {
    return NextResponse.json({ ok: false, dates: [] }, { status: 400 });
  }
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_available_event_dates", {
    p_embed_key: key,
    p_start: start,
    p_end: end,
  });
  const payload = data as { ok?: boolean; dates?: string[] } | null;
  if (!payload?.ok) return NextResponse.json({ ok: false, dates: [] });
  return NextResponse.json({ ok: true, dates: payload.dates ?? [] });
}
