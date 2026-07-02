/**
 * GET /api/portal/payments?token=...
 *
 * Returns the couple's payment schedule(s) with line items.
 * Read-only — couples view their financial picture; they cannot mark payments
 * paid through the portal (online payments are a future sprint).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_portal_payments", { p_token: token });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { schedules: [] });
}
