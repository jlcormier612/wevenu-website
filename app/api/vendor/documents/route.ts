import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function GET(req: NextRequest) {
  const token   = req.nextUrl.searchParams.get("token");
  const eventId = req.nextUrl.searchParams.get("eventId");

  if (!token || !eventId) {
    return NextResponse.json({ error: "token and eventId are required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_vendor_event_documents", {
    p_token:    token,
    p_event_id: eventId,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const result = data as { documents?: unknown[]; error?: string } | null;
  if (result?.error) return NextResponse.json({ error: result.error }, { status: result.error === "invalid_token" ? 401 : 403 });

  return NextResponse.json({ documents: result?.documents ?? [] });
}
