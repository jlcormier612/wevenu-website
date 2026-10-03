import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

// Canonical Conversation unread count for the venue sidebar badge.
// Working Inbox population only — same filter as Inbox header total_unread.
// Not a needs_response count. Path retained for existing clients.
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_conversation_unread_count");
  return NextResponse.json(data ?? { count: 0 });
}
