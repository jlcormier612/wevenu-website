import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function POST(req: NextRequest) {
  const body = await req.json() as { ids?: string[] };
  const ids = body.ids ?? [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_notifications_read", {
    p_notification_ids: ids,
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const result = data as { ok: boolean } | null;
  return NextResponse.json({ ok: result?.ok ?? false });
}
