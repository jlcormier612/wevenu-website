/**
 * GET /api/portal/journey?token=...
 *
 * Returns all journal entries for the couple in chronological order
 * (oldest first). Used by the Journey tab timeline. Distinct from
 * /api/portal/journal which returns newest-first for the editing view.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import type { JournalEntry } from "@/lib/portal/types";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "Missing token." }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_journey_timeline", { p_token: token });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const raw = data as { entries?: JournalEntry[]; error?: string } | null;
  if (raw?.error) return NextResponse.json({ error: raw.error }, { status: 401 });

  return NextResponse.json({ entries: raw?.entries ?? [] });
}
