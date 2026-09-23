/**
 * GET /api/portal/payments?token=...
 *
 * Returns the couple's payment schedule(s) with line items. Read-only —
 * a couple can start a real payment (POST /api/portal/checkout, Sprint 4),
 * but this route itself never mutates anything; the payment_line_item's
 * status only ever changes via the Stripe webhook confirming what
 * actually happened.
 *
 * Schedules are canonicalized to one plan per invoice (newest wins) so Home,
 * Tasks, Payments, and Documents receipts share the same obligation set.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import { selectCanonicalPaymentSchedules, type PortalPaymentScheduleLike } from "@/lib/portal/payment-schedules";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_portal_payments", { p_token: token });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const payload = (data ?? { schedules: [] }) as { schedules?: PortalPaymentScheduleLike[]; error?: string };
  if (payload.error) return NextResponse.json(payload);

  // Same readiness rule as get_portal_checkout_context — surface before Pay is clickable.
  let onlinePaymentsReady = false;
  try {
    const { createAdminClient } = await import("@/integrations/supabase/admin");
    const admin = createAdminClient();
    const { data: session } = await admin
      .from("client_portal_sessions")
      .select("venue_id")
      .eq("access_token", token)
      .maybeSingle<{ venue_id: string }>();
    if (session?.venue_id) {
      const { data: venue } = await admin
        .from("venues")
        .select("stripe_account_id, stripe_onboarding_status, stripe_charges_enabled")
        .eq("id", session.venue_id)
        .maybeSingle<{
          stripe_account_id: string | null;
          stripe_onboarding_status: string | null;
          stripe_charges_enabled: boolean | null;
        }>();
      onlinePaymentsReady = Boolean(
        venue?.stripe_account_id &&
          venue.stripe_onboarding_status === "connected" &&
          venue.stripe_charges_enabled === true,
      );
    }
  } catch {
    onlinePaymentsReady = false;
  }

  return NextResponse.json({
    ...payload,
    schedules: selectCanonicalPaymentSchedules(payload.schedules ?? []),
    onlinePaymentsReady,
  });
}
