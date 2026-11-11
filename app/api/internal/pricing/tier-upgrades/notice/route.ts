import { NextResponse } from "next/server";

import {
  assertPhase3RehearsalFixture,
  getTierUpgradeStore,
  maySendTierUpgradeNotice,
  resolveTierUpgradeNoticeRecipient,
  sendTierUpgradeNotice,
} from "@shared/pricing";
import { createAdminClient } from "@/integrations/supabase/admin";
import { createSaasStripeClient } from "@/lib/billing/saas-stripe";
import { isSupabaseConfigured } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Phase 3 notice send.
 *
 * Authorized when:
 * - Global TIER_UPGRADE_SEND_NOTICE=true (Sandbox population; recipients
 *   redirected to the approved internal inbox), OR
 * - Fixture rehearsal: TIER_UPGRADE_REHEARSAL_ENABLED + htc_phase3_rehearsal
 *   metadata on customer and subscription.
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
          ["pending_notice", "evaluated", "notice_sent"].includes(u.status),
        )) ?? null;
  if (!upgrade) {
    return NextResponse.json(
      { error: "No pending upgrade ready for notice" },
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

  const [customer, subscription] = await Promise.all([
    stripe.customers.retrieve(customerId),
    stripe.subscriptions.retrieve(subscriptionId),
  ]);
  if ("deleted" in customer && customer.deleted) {
    return NextResponse.json({ error: "Stripe customer deleted" }, { status: 400 });
  }

  const sendNoticeGlobal = process.env.TIER_UPGRADE_SEND_NOTICE === "true";
  let fixtureAuthorized = false;

  if (!sendNoticeGlobal) {
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
    fixtureAuthorized = true;
  }

  if (
    !maySendTierUpgradeNotice({
      isRehearsalFixture: fixtureAuthorized,
    })
  ) {
    return NextResponse.json(
      { error: "Notice send not authorized (global and fixture gates closed)" },
      { status: 403 },
    );
  }

  const billingEmail =
    (customer as { email?: string | null }).email?.trim() || "";
  const recipient = resolveTierUpgradeNoticeRecipient({
    billingEmail,
    forceInternalRedirect: sendNoticeGlobal,
  });
  if (!recipient.ok) {
    return NextResponse.json({ error: recipient.reason }, { status: 403 });
  }

  const sent = await sendTierUpgradeNotice({
    store,
    upgrade,
    venueName: (venue.name as string) || "Your venue",
    toEmail: recipient.email,
    contactEmail: "jennifer@hellotocheers.com",
  });

  if (!sent.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: sent.code,
        message: sent.message,
        deliveryStatus: sent.deliveryStatus,
        upgradeId: sent.upgrade?.id ?? upgrade.id,
        redirected: recipient.redirected,
        originalEmail: recipient.originalEmail,
        gates: {
          sendNoticeGlobal,
          fixtureAuthorized,
        },
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    deliveryStatus: sent.deliveryStatus,
    providerMessageId: sent.providerMessageId,
    noticeSentAt: sent.noticeSentAt,
    idempotencyKey: sent.idempotencyKey,
    to: sent.to,
    redirected: recipient.redirected,
    originalEmail: recipient.originalEmail,
    subject: sent.subject,
    upgradeId: sent.upgrade.id,
    status: sent.upgrade.status,
    gates: {
      sendNoticeGlobal,
      fixtureAuthorized,
    },
  });
}
