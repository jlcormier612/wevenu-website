import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token") ?? "";
  const eventId = searchParams.get("eventId") ?? "";
  if (!token || !eventId) return NextResponse.json({ tasks: [] });
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_vendor_event_tasks", { p_token: token, p_event_id: eventId });
  return NextResponse.json(data ?? { tasks: [] });
}
