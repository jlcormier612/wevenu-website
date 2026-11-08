import { NextResponse } from "next/server";

import { createAdminClient } from "@/integrations/supabase/admin";
import {
  applyStripeSubscriptionToVenue,
  evaluateVenueEntitlement,
  entitlementDecisionToVenuePatch,
  rowToSnapshot,
  type VenueEntitlementRow,
} from "@/lib/entitlement";
import { isSupabaseConfigured } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Reconcile HTC venue entitlement from persisted Stripe mirror fields.
 *
 * Auth: Bearer PRODUCT_SYNC_API_KEY or CRON_SECRET.
 *
 * Primary Stripe→HTC sync remains marketing `/api/stripe/webhook`.
 * This job heals missed applications using stored cancel_at_period_end /
 * current_period_end / overrides — without calling Connect Stripe keys.
 *
 * Optional SaaS retrieve: set HTC_SAAS_STRIPE_SECRET_KEY (Hello to Cheers
 * subscription account, not Connect) to refresh facts from Stripe first.
 */

function authorize(request: Request): boolean {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return false;
  const productKey = process.env.PRODUCT_SYNC_API_KEY?.trim();
  const cronKey = process.env.CRON_SECRET?.trim();
  return Boolean(
    (productKey && token === productKey) || (cronKey && token === cronKey),
  );
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  let limit = 50;
  try {
    const body = (await request.json().catch(() => ({}))) as { limit?: number };
    if (typeof body.limit === "number" && body.limit > 0) {
      limit = Math.min(body.limit, 200);
    }
  } catch {
    /* empty ok */
  }

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("venues")
    .select(
      "id, saas_stripe_customer_id, saas_stripe_subscription_id, saas_subscription_status, cancel_at_period_end, current_period_end, access_disabled, access_override_until, pause_billing_suspend, manual_security_lock, access_loss_reason, access_ended_at, retention_hold, entitlement_status, account_status, access_ends_at, retention_started_at, deletion_eligible_at",
    )
    .or(
      "saas_stripe_subscription_id.not.is.null,cancel_at_period_end.eq.true,access_override_until.not.is.null,saas_subscription_status.eq.past_due",
    )
    .limit(limit);

  if (error) {
    if (/column|does not exist/i.test(error.message)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Entitlement columns missing — apply migration 20261427700000_venue_saas_entitlement_phase1.sql before reconcile.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const saasKey = process.env.HTC_SAAS_STRIPE_SECRET_KEY?.trim();
  const results: Array<Record<string, unknown>> = [];

  for (const row of (rows ?? []) as VenueEntitlementRow[]) {
    try {
      if (saasKey && row.saas_stripe_subscription_id) {
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(saasKey);
        const sub = await stripe.subscriptions.retrieve(row.saas_stripe_subscription_id);
        const periodEndUnix = (sub as { current_period_end?: number }).current_period_end;
        const currentPeriodEnd =
          typeof periodEndUnix === "number"
            ? new Date(periodEndUnix * 1000).toISOString()
            : null;
        const applied = await applyStripeSubscriptionToVenue({
          venueId: row.id,
          stripeCustomerId:
            typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
          stripeSubscriptionId: sub.id,
          stripeStatus: sub.status,
          cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
          currentPeriodEnd,
          reason: "entitlement_reconcile_saas",
          actorId: "reconcile_job",
        });
        results.push({
          venueId: row.id,
          ok: applied.ok,
          source: "saas_stripe",
          entitled: applied.decision.entitled,
          status: applied.decision.entitlementStatus,
          detail: applied.detail,
        });
        continue;
      }

      const decision = evaluateVenueEntitlement(rowToSnapshot(row));
      let finalDecision = decision;
      if (row.manual_security_lock === true && decision.entitled) {
        finalDecision = {
          ...decision,
          entitled: false,
          entitlementStatus: "suspended",
          accessLossReason: "manual_security",
          reasonCode: "manual_security_lock",
          summary: "Security lock remains in effect during reconcile.",
          nextAction: "Clear security lock explicitly.",
        };
      }
      const patch = entitlementDecisionToVenuePatch(finalDecision, {
        stripeStatus: row.saas_subscription_status,
        cancelAtPeriodEnd: row.cancel_at_period_end === true,
        currentPeriodEnd: row.current_period_end,
      });
      const { error: updErr } = await admin.from("venues").update(patch).eq("id", row.id);
      results.push({
        venueId: row.id,
        ok: !updErr,
        source: "local_mirror",
        entitled: finalDecision.entitled,
        status: finalDecision.entitlementStatus,
        detail: updErr?.message || finalDecision.summary,
      });
    } catch (err) {
      results.push({
        venueId: row.id,
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: results.length,
    saasRetrieveEnabled: Boolean(saasKey),
    results,
  });
}
