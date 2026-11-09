import { NextResponse } from "next/server";

import {
  assertPhase3RehearsalFixture,
  getTierUpgradeStore,
  mayApplyTierUpgradeStripe,
  releaseScheduledTierUpgrade,
} from "@shared/pricing";
import { createAdminClient } from "@/integrations/supabase/admin";
import { createSaasStripeClient } from "@/lib/billing/saas-stripe";
import { isSupabaseConfigured } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Fixture-only Stripe schedule release for cancelled / held upgrades.
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
    reason?: string;
  };
  if (!body.venueId?.trim() || !body.upgradeId?.trim()) {
    return NextResponse.json(
      { error: "venueId and upgradeId are required" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: venue, error } = await admin
    .from("venues")
    .select("id, saas_stripe_subscription_id, saas_stripe_customer_id")
    .eq("id", body.venueId.trim())
    .maybeSingle();
  if (error || !venue) {
    return NextResponse.json(
      { error: error?.message || "Venue not found" },
      { status: 404 },
    );
  }

  const store = getTierUpgradeStore();
  const upgrade = await store.getUpgradeById(body.upgradeId.trim());
  if (!upgrade || upgrade.venueId !== venue.id) {
    return NextResponse.json({ error: "Upgrade not found" }, { status: 404 });
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

  const [customer, subscription] = await Promise.all([
    stripe.customers.retrieve(customerId),
    stripe.subscriptions.retrieve(subscriptionId),
  ]);
  if ("deleted" in customer && customer.deleted) {
    return NextResponse.json({ error: "Stripe customer deleted" }, { status: 400 });
  }

  const fixture = assertPhase3RehearsalFixture({
    venueId: venue.id,
    customer: {
      id: customer.id,
      metadata: (customer as { metadata?: Record<string, string> }).metadata,
    },
    subscription: {
      id: subscription.id,
      metadata: (subscription as { metadata?: Record<string, string> }).metadata,
    },
  });
  if (!fixture.ok) {
    return NextResponse.json({ error: fixture.reason }, { status: 403 });
  }
  if (!mayApplyTierUpgradeStripe({ isRehearsalFixture: true })) {
    return NextResponse.json(
      { error: "Stripe release not authorized" },
      { status: 403 },
    );
  }

  const result = await releaseScheduledTierUpgrade({
    store,
    stripe: stripe as Parameters<typeof releaseScheduledTierUpgrade>[0]["stripe"],
    upgrade,
    reason: body.reason?.trim() || "Rehearsal cancellation / founder hold release",
  });

  return NextResponse.json({
    ok: result.ok,
    code: result.code,
    message: result.message,
    stripeConfirmed: result.stripeConfirmed,
    upgradeId: result.upgrade.id,
    status: result.upgrade.status,
    scheduleId: result.upgrade.stripeScheduleId,
  });
}
