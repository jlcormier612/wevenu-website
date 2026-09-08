import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

// Canonical Conversation unread count for the venue sidebar badge.
// Path retained as /api/messages/unread for existing clients (sidebar-nav).
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_conversation_unread_count");
  return NextResponse.json(data ?? { count: 0 });
}
