/**
 * COMPATIBILITY-ONLY — not deleted. Only caller is
 * app/(app)/messaging/legacy-inbox.tsx, itself no longer wired into any
 * live route as of RC2, Milestone 5. Backs the couple_threads/
 * couple_messages system via get_couple_inbox/ensure_couple_thread.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_couple_inbox");
  return NextResponse.json(data ?? { threads: [], total_unread: 0 });
}

export async function POST(request: Request) {
  const { clientId } = await request.json() as { clientId?: string };
  if (!clientId) return NextResponse.json({ ok: false, error: "Missing clientId" }, { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase.rpc("ensure_couple_thread", { p_client_id: clientId });
  return NextResponse.json(data ?? { ok: false });
}
