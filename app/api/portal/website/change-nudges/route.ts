/**
 * GET  /api/portal/website/change-nudges?token=...
 *      Detects (on-demand) and returns active change-notification nudges
 *      for the couple's published website — e.g. a Timeline change after
 *      publish that guests who already RSVP'd haven't been told about.
 *
 * POST /api/portal/website/change-nudges
 *      Body: { token, nudgeId, notified?: boolean }
 *      Dismisses a nudge, optionally recording that guests were notified.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_website_change_nudges", { p_token: token });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ nudges: data ?? [] });
}

export async function POST(request: Request) {
  const { token, nudgeId, notified } = await request.json() as { token?: string; nudgeId?: string; notified?: boolean };
  if (!token || !nudgeId) {
    return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("dismiss_website_change_nudge", {
    p_token: token, p_nudge_id: nudgeId, p_notified: notified ?? false,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
