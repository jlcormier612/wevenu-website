import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

/**
 * Invitation & RSVP progress dashboard (Guest Experience — Phase 2).
 * GET ?token=... → invitation funnel counts, outstanding households,
 * recently responded guests. Read-only aggregation over existing data.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "Missing token." }, { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_invitation_progress", { p_token: token });
  return NextResponse.json(data ?? { error: "Could not load progress." });
}
