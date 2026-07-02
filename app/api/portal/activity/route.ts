/**
 * GET /api/portal/activity?token=...
 *
 * Returns a 7-day rolling activity summary for the "This Week" sidebar card.
 * Aggregates across: media uploads, guest additions, completed todos, and
 * journal entries. Returns up to ~8 labelled activity items plus a
 * totalThisWeek count (used to detect "quiet week" state).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import type { RecentActivity } from "@/lib/portal/types";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "Missing token." }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_recent_activity", { p_token: token });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const raw = data as RecentActivity & { error?: string } | null;
  if (raw?.error) return NextResponse.json({ error: raw.error }, { status: 401 });

  return NextResponse.json({
    activity:      raw?.activity      ?? [],
    totalThisWeek: raw?.totalThisWeek ?? 0,
  } satisfies RecentActivity);
}
