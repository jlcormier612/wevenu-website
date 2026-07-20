import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

// Hosted Experience Platform Phase 4 — "preview as this guest," backing
// components/portal/guest-section.tsx's GuestRsvpPreviewButton. Portal-token
// authenticated (the couple's own session), not guest-token authenticated —
// preview_rsvp_as_guest scopes the lookup to guests belonging to that
// session's own client, so a couple can only ever preview their own guests.
export async function POST(request: Request) {
  const { token, guestId } = await request.json() as { token?: string; guestId?: string };
  if (!token || !guestId) {
    return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc("preview_rsvp_as_guest", { p_token: token, p_guest_id: guestId });

  if (!data || (data as Record<string, unknown>).error) {
    return NextResponse.json({ ok: false, error: "not_found" });
  }

  return NextResponse.json({ ok: true, context: data });
}
