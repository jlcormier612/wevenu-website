import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import { getCurrentVenue } from "@/lib/venue/service";

// Program 2 Phase 2B: the badge itself doesn't change (sidebar-nav.tsx is
// untouched) — only which system it reads from does, gated by the same
// per-venue rollout flag the Messaging page uses. A venue mid-rollout never
// sees a badge that disagrees with which inbox it actually lands on.
export async function GET() {
  const venue = await getCurrentVenue();
  const supabase = await createClient();
  const { data } = venue?.conversationExperienceEnabled
    ? await supabase.rpc("get_conversation_unread_count")
    : await supabase.rpc("get_couple_unread_count");
  return NextResponse.json(data ?? { count: 0 });
}
