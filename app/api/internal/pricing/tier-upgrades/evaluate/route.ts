import { NextResponse } from "next/server";

import {
  assertVenueSubscriptionIsolation,
  billingSnapshotFromStripeSubscription,
  evaluateAndPersistTierUpgrade,
  getPricingOfferStore,
  getTierUpgradeStore,
  mapEventRowsToVolumeInputs,
  resolveSaasStripeSecretKey,
  type EventVolumeRow,
  type StripeSubscriptionLike,
} from "@shared/pricing";
import { createAdminClient } from "@/integrations/supabase/admin";
import { createSaasStripeClient } from "@/lib/billing/saas-stripe";
import { isSupabaseConfigured } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Phase 3 cron/evaluate entrypoint.
 *
 * Auth: Bearer PRODUCT_SYNC_API_KEY or CRON_SECRET.
 *
 * Retrieves the authoritative SaaS Stripe subscription for each venue, maps it
 * through billingSnapshotFromStripeSubscription, then persists pending-upgrade
 * intent only. Stripe schedule mutations and notice sends remain OFF unless
 * separately gated (must stay false for this Sandbox integration checkpoint).
 *
 * Do not pass venueId lists for the full Sandbox population from a scheduler
 * until automatic upgrades are separately authorized.
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
  if (!resolveSaasStripeSecretKey()) {
    return NextResponse.json(
      {
        error:
          "HTC_SAAS_STRIPE_SECRET_KEY missing — refuse evaluation without authoritative Stripe retrieve",
      },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    venueId?: string;
    limit?: number;
  };
  // Hard cap — never bulk-evaluate the Sandbox population from this checkpoint.
  const limit = Math.min(Math.max(body.limit ?? 1, 1), 5);
  if (!body.venueId) {
    return NextResponse.json(
      {
        error:
          "venueId is required while automatic population evaluation is disabled",
      },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: venues, error } = await admin
    .from("venues")
    .select(
      "id, name, saas_stripe_subscription_id, saas_stripe_customer_id, saas_subscription_status, cancel_at_period_end, current_period_end, saas_plan_key",
    )
    .eq("id", body.venueId)
    .not("saas_stripe_subscription_id", "is", null)
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let stripe;
  let keySource: string;
  try {
    const client = await createSaasStripeClient();
    stripe = client.stripe;
    keySource = client.keySource;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Stripe client failed" },
      { status: 503 },
    );
  }

  const store = getTierUpgradeStore();
  const offerStore = getPricingOfferStore();
  const results: Array<Record<string, unknown>> = [];

  for (const venue of venues ?? []) {
    const subscriptionId = venue.saas_stripe_subscription_id as string | null;
    if (!subscriptionId) continue;

    try {
      const sub = (await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ["discounts.source.coupon", "items.data.price"],
      })) as StripeSubscriptionLike;
      const snapshot = billingSnapshotFromStripeSubscription(sub);
      if (!snapshot) {
        results.push({
          venueId: venue.id,
          skipped: true,
          reason: "Stripe subscription missing current_period_end — fail closed",
        });
        continue;
      }

      const isolation = assertVenueSubscriptionIsolation({
        venueId: venue.id,
        venueStripeSubscriptionId: subscriptionId,
        venueStripeCustomerId:
          (venue.saas_stripe_customer_id as string | null) ?? null,
        snapshot,
      });
      if (!isolation.ok) {
        results.push({
          venueId: venue.id,
          skipped: true,
          reason: isolation.reason,
        });
        continue;
      }

      if (!snapshot.planKey) {
        results.push({
          venueId: venue.id,
          skipped: true,
          reason:
            "Subscription price is not a known Launch V1 Price — refuse automatic evaluation",
          priceId: snapshot.priceId,
        });
        continue;
      }

      const { data: rows, error: eventsError } = await admin
        .from("events")
        .select("id, status, event_date, booked_at")
        .eq("venue_id", venue.id);
      if (eventsError) {
        results.push({
          venueId: venue.id,
          skipped: true,
          reason: `event load failed: ${eventsError.message}`,
        });
        continue;
      }

      const events = mapEventRowsToVolumeInputs((rows ?? []) as EventVolumeRow[]);
      const earned = await offerStore.listEarnedGrantsForVenue(venue.id);
      const grants = earned.map((g) => ({
        id: g.id,
        offerType: g.offerType,
        percentOff: g.percentOff,
        status: g.status,
      }));

      const result = await evaluateAndPersistTierUpgrade({
        venueId: venue.id,
        events,
        subscription: snapshot,
        grants,
        store,
      });

      results.push({
        venueId: venue.id,
        decision: result.decisionAction,
        reason: result.reason,
        upgradeId: result.upgrade?.id ?? null,
        status: result.upgrade?.status ?? null,
        requiredPlan: result.upgrade?.requiredPlanKey ?? null,
        effectiveAt: result.upgrade?.scheduledEffectiveAt ?? null,
        stripe: {
          subscriptionId: snapshot.subscriptionId,
          customerId: snapshot.customerId,
          priceId: snapshot.priceId,
          planKey: snapshot.planKey,
          periodStart: snapshot.currentPeriodStartUnix,
          periodEnd: snapshot.currentPeriodEndUnix,
          couponId: snapshot.couponId,
          scheduleId: snapshot.scheduleId,
          billingCycleAnchor: snapshot.billingCycleAnchorUnix,
          status: snapshot.status,
        },
        scheduleIntentPrepared: Boolean(result.scheduleIntent),
        scheduleReleasePrepared: Boolean(result.scheduleReleaseIntent),
        applyStripe: false,
        sendNotice: false,
      });
    } catch (err) {
      results.push({
        venueId: venue.id,
        skipped: true,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    evaluated: results.length,
    results,
    stripeKeySource: keySource,
    gates: {
      applyStripe: process.env.TIER_UPGRADE_APPLY_STRIPE === "true",
      sendNotice: process.env.TIER_UPGRADE_SEND_NOTICE === "true",
      store: process.env.PRICING_TIER_UPGRADE_STORE || "memory",
    },
  });
}
