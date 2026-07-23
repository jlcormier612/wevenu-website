/**
 * GET /api/portal/payments?token=...
 *
 * Returns the couple's payment schedule(s) with line items. Read-only —
 * a couple can start a real payment (POST /api/portal/checkout, Sprint 4),
 * but this route itself never mutates anything; the payment_line_item's
 * status only ever changes via the Stripe webhook confirming what
 * actually happened.
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
