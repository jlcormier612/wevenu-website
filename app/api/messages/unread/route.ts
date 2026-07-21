import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

// RC2, Milestone 5: every venue now reads the canonical Conversation unread
// count (sidebar-nav.tsx itself is untouched — only the backend is). The
// legacy get_couple_unread_count() RPC still exists (compatibility-only,
// backs legacy-inbox.tsx) but is no longer called here.
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_conversation_unread_count");
  return NextResponse.json(data ?? { count: 0 });
}
