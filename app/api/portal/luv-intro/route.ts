/**
 * Luv Experience Completion, Work Stream 5 — the couple portal's one-time
 * intro card. Routed through SECURITY DEFINER RPCs that validate the token
 * server-side (get_luv_intro_seen / mark_luv_intro_seen) — never a raw
 * anon-key read of client_portal_sessions, the exact class of gap TR-L6
 * closed (docs/trust-risk-register.md).
 */
import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return NextResponse.json({ seen: true });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_luv_intro_seen", { p_token: token });
  if (error) return NextResponse.json({ seen: true });
  return NextResponse.json(data ?? { seen: true });
}

export async function POST(request: Request) {
  const { token } = await request.json() as { token?: string };
  if (!token) return NextResponse.json({ ok: false }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_luv_intro_seen", { p_token: token });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { ok: false });
}
