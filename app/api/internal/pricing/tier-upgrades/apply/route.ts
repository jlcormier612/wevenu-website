import { NextResponse } from "next/server";

import {
  applyTierUpgradeSchedule,
  assertPhase3RehearsalFixture,
  billingSnapshotFromStripeSubscription,
  getTierUpgradeStore,
  mapEventRowsToVolumeInputs,
  mayApplyTierUpgradeStripe,
  type EventVolumeRow,
  type StripeSubscriptionLike,
} from "@shared/pricing";
import { createAdminClient } from "@/integrations/supabase/admin";
import { createSaasStripeClient } from "@/lib/billing/saas-stripe";
import { isSupabaseConfigured } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Phase 3 Stripe schedule apply.
 *
 * Authorized when:
 * - Global TIER_UPGRADE_APPLY_STRIPE=true (Sandbox population), OR
 * - Fixture rehearsal: TIER_UPGRADE_REHEARSAL_ENABLED + htc_phase3_rehearsal
 *   metadata on customer and subscription (and notice already accepted).
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

  const body = (await request.json().catch(() => ({}))) as {
    venueId?: string;
    upgradeId?: string;
  };
  if (!body.venueId?.trim()) {
    return NextResponse.json({ error: "venueId is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: venue, error } = await admin
    .from("venues")
    .select(
      "id, name, saas_stripe_subscription_id, saas_stripe_customer_id",
    )
    .eq("id", body.venueId.trim())
    .maybeSingle();
  if (error || !venue) {
    return NextResponse.json(
      { error: error?.message || "Venue not found" },
      { status: 404 },
    );
  }

  const store = getTierUpgradeStore();
  const upgrades = await store.listUpgradesForVenue(venue.id);
  const upgrade =
    (body.upgradeId
      ? upgrades.find((u) => u.id === body.upgradeId)
      : upgrades.find((u) =>
          ["notice_sent", "scheduled"].includes(u.status),
        )) ?? null;
  if (!upgrade) {
    return NextResponse.json(
      { error: "No notice_sent/scheduled upgrade ready to apply" },
      { status: 404 },
    );
  }

  let stripe;
  try {
    const client = await createSaasStripeClient();
    stripe = client.stripe;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Stripe client failed" },
      { status: 503 },
    );
  }

  const subscriptionId =
    (venue.saas_stripe_subscription_id as string | null) ||
    upgrade.stripeSubscriptionId;
  const customerId =
    (venue.saas_stripe_customer_id as string | null) ||
    upgrade.stripeCustomerId;
  if (!subscriptionId || !customerId) {
    return NextResponse.json(
      { error: "Venue missing Stripe subscription/customer" },
      { status: 400 },
    );
  }

  const [customer, subRaw] = await Promise.all([
    stripe.customers.retrieve(customerId),
    stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["discounts.source.coupon", "items.data.price"],
    }),
  ]);
  if ("deleted" in customer && customer.deleted) {
    return NextResponse.json({ error: "Stripe customer deleted" }, { status: 400 });
  }

  const applyStripeGlobal = process.env.TIER_UPGRADE_APPLY_STRIPE === "true";
  let fixtureAuthorized = false;

  if (!applyStripeGlobal) {
    const fixture = assertPhase3RehearsalFixture({
      venueId: venue.id,
      customer: {
        id: customer.id,
        metadata: (customer as { metadata?: Record<string, string> }).metadata,
      },
      subscription: {
        id: subRaw.id,
        metadata: (subRaw as { metadata?: Record<string, string> }).metadata,
      },
    });
    if (!fixture.ok) {
      return NextResponse.json({ error: fixture.reason }, { status: 403 });
    }
    fixtureAuthorized = true;
  }

  if (
    !mayApplyTierUpgradeStripe({
      isRehearsalFixture: fixtureAuthorized,
    })
  ) {
    return NextResponse.json(
      { error: "Stripe apply not authorized (global and fixture gates closed)" },
      { status: 403 },
    );
  }

  const snapshot = billingSnapshotFromStripeSubscription(
    subRaw as StripeSubscriptionLike,
  );
  if (!snapshot) {
    return NextResponse.json(
      { error: "Stripe subscription missing current_period_end" },
      { status: 400 },
    );
  }

  const { data: rows, error: eventsError } = await admin
    .from("events")
    .select("id, status, event_date, booked_at")
    .eq("venue_id", venue.id);
  if (eventsError) {
    return NextResponse.json({ error: eventsError.message }, { status: 500 });
  }
  const events = mapEventRowsToVolumeInputs((rows ?? []) as EventVolumeRow[]);
  const hold = await store.getActiveHoldForVenue(venue.id);

  const applied = await applyTierUpgradeSchedule({
    store,
    stripe: stripe as Parameters<typeof applyTierUpgradeSchedule>[0]["stripe"],
    upgrade,
    subscription: snapshot,
    events,
    activeHold: Boolean(hold),
    applyAuthorized: true,
  });

  if (!applied.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: applied.code,
        message: applied.message,
        defer: applied.defer ?? false,
        upgradeId: applied.upgrade?.id ?? upgrade.id,
        status: applied.upgrade?.status ?? upgrade.status,
        gates: {
          applyStripeGlobal,
          fixtureAuthorized,
        },
      },
      { status: applied.defer ? 409 : 422 },
    );
  }

  return NextResponse.json({
    ok: true,
    scheduleId: applied.scheduleId,
    upgradeId: applied.upgrade.id,
    status: applied.upgrade.status,
    effectiveAt: applied.upgrade.scheduledEffectiveAt,
    reason: applied.reason,
    gates: {
      applyStripeGlobal,
      fixtureAuthorized,
    },
  });
}
