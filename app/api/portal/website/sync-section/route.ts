/**
 * POST /api/portal/website/sync-section
 *
 * Stamps a guided section's last_synced_at after the couple explicitly
 * accepts a refreshed value pulled from Planning and saves it — see
 * docs/hosted-experience-platform-architecture-spec.md §3/§4. Called
 * right after the normal content save succeeds, not instead of it.
 *
 * Body: { token, sectionKey }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function POST(request: Request) {
  const { token, sectionKey } = await request.json() as { token?: string; sectionKey?: string };
  if (!token || !sectionKey) {
    return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_section_synced", { p_token: token, p_section_key: sectionKey });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
