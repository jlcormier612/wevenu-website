/**
 * GET  /api/portal/guest-count?token=...
 *      Live suggested count (from the couple's own current RSVPs), the
 *      event's current committed guest_count, and the submission history.
 *
 * POST /api/portal/guest-count
 *      Body: { token, count, note? }
 *      The couple's Commitment action — Commitment Lifecycle Architecture
 *      §2/§8: this is the Submit event, and its own completion is the
 *      "Submit your guest count" Playbook task's commit point.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_guest_count_status", { p_token: token });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || (data as Record<string, unknown>).error) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const { token, count, note } = await request.json() as { token?: string; count?: number; note?: string };
  if (!token || count === undefined || count === null) {
    return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_guest_count", {
    p_token: token, p_count: count, p_note: note ?? null,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json(data ?? { ok: false });
}
