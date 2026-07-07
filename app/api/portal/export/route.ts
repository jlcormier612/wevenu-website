/**
 * GET /api/portal/export?token=...
 *
 * Resolves docs/trust-risk-register.md TR-G2 — the couple can download a
 * complete copy of their own guest list, budget, and seating data at any
 * time. Read-only, token-authenticated (same pattern as /api/portal/payments).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_portal_export", { p_token: token });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (data && typeof data === "object" && "error" in data) {
    return NextResponse.json(data, { status: 404 });
  }
  return NextResponse.json(data, {
    headers: {
      "Content-Disposition": `attachment; filename="my-wevenu-data-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
