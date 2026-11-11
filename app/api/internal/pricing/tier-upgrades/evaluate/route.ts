import { NextResponse } from "next/server";

import {
  evaluateVenueTierUpgrade,
  getPricingOfferStore,
  getTierUpgradeStore,
  resolveSaasStripeSecretKey,
  type EventVolumeRow,
  type VenueTierUpgradeSource,
} from "@shared/pricing";
import { createAdminClient } from "@/integrations/supabase/admin";
import { createSaasStripeClient } from "@/lib/billing/saas-stripe";
import { isSupabaseConfigured } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Phase 3 evaluate entrypoint (single venue or bounded population page).
 *
 * Auth: Bearer PRODUCT_SYNC_API_KEY or CRON_SECRET.
 *
 * Retrieves the authoritative SaaS Stripe subscription for each venue, maps it
 * through billingSnapshotFromStripeSubscription, then persists pending-upgrade
 * intent only. Stripe schedule mutations and notice sends remain gated by
 * TIER_UPGRADE_APPLY_STRIPE / TIER_UPGRADE_SEND_NOTICE.
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
    offset?: number;
  };
  // Bounded page — population callers must page via offset.
  const limit = Math.min(Math.max(body.limit ?? 25, 1), 25);
  const offset = Math.max(body.offset ?? 0, 0);

  const admin = createAdminClient();
  let query = admin
    .from("venues")
    .select(
      "id, name, saas_stripe_subscription_id, saas_stripe_customer_id, saas_subscription_status, cancel_at_period_end, current_period_end, saas_plan_key",
    )
    .not("saas_stripe_subscription_id", "is", null)
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (body.venueId?.trim()) {
    query = admin
      .from("venues")
      .select(
        "id, name, saas_stripe_subscription_id, saas_stripe_customer_id, saas_subscription_status, cancel_at_period_end, current_period_end, saas_plan_key",
      )
      .eq("id", body.venueId.trim())
      .not("saas_stripe_subscription_id", "is", null)
      .limit(1);
  }

  const { data: venues, error } = await query;

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

  const deps = {
    store,
    stripe: stripe as Parameters<typeof evaluateVenueTierUpgrade>[1]["stripe"],
    listEvents: async (venueId: string) => {
      const { data: rows, error: eventsError } = await admin
        .from("events")
        .select("id, status, event_date, booked_at")
        .eq("venue_id", venueId);
      if (eventsError) throw new Error(eventsError.message);
      return (rows ?? []) as EventVolumeRow[];
    },
    listGrants: async (venueId: string) => {
      const earned = await offerStore.listEarnedGrantsForVenue(venueId);
      return earned.map((g) => ({
        id: g.id,
        offerType: g.offerType,
        percentOff: g.percentOff,
        status: g.status,
      }));
    },
  };

  for (const venue of (venues ?? []) as VenueTierUpgradeSource[]) {
    const outcome = await evaluateVenueTierUpgrade(venue, deps);
    results.push({
      ...outcome,
      applyStripe: process.env.TIER_UPGRADE_APPLY_STRIPE === "true",
      sendNotice: process.env.TIER_UPGRADE_SEND_NOTICE === "true",
    });
  }

  return NextResponse.json({
    ok: true,
    evaluated: results.length,
    offset,
    limit,
    results,
    stripeKeySource: keySource,
    gates: {
      applyStripe: process.env.TIER_UPGRADE_APPLY_STRIPE === "true",
      sendNotice: process.env.TIER_UPGRADE_SEND_NOTICE === "true",
      store: process.env.PRICING_TIER_UPGRADE_STORE || "memory",
      rehearsalEnabled: process.env.TIER_UPGRADE_REHEARSAL_ENABLED === "true",
    },
  });
}
