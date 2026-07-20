import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

// Hosted Experience Platform Phase 4 — real server-side validation for the
// embedded on-site RSVP lookup (components/wedding-website/wedding-website.tsx's
// RsvpSection), replacing a client-side "length > 10" check that accepted
// any long-enough string as "found" with no confirmation the code was ever
// real. Same get_rsvp_context RPC the personalized /rsvp/[token] page
// already uses — one real lookup, not a second, thinner one.
export async function POST(request: Request) {
  const { token } = await request.json() as { token?: string };
  if (!token || !token.trim()) {
    return NextResponse.json({ ok: false, error: "missing_token" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc("get_rsvp_context", { p_rsvp_token: token.trim() });

  if (!data || (data as Record<string, unknown>).error) {
    return NextResponse.json({ ok: false, error: "not_found" });
  }

  return NextResponse.json({ ok: true, context: data });
}
