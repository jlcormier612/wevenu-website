import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function POST(req: NextRequest) {
  const body = await req.json() as { token?: string; eventId?: string; field?: string };
  const { token, eventId, field } = body;

  if (!token || !eventId || !field) {
    return NextResponse.json({ error: "token, eventId, and field are required" }, { status: 400 });
  }
  if (!["checked_in", "setup_complete"].includes(field)) {
    return NextResponse.json({ error: "field must be checked_in or setup_complete" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("vendor_self_checkin", {
    p_token:    token,
    p_event_id: eventId,
    p_field:    field,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const result = data as { ok: boolean; error?: string; checkedInAt?: string; setupCompleteAt?: string } | null;
  if (!result?.ok) return NextResponse.json({ error: result?.error ?? "failed" }, { status: 403 });

  return NextResponse.json({
    ok: true,
    checkedInAt: result.checkedInAt ?? null,
    setupCompleteAt: result.setupCompleteAt ?? null,
  });
}
