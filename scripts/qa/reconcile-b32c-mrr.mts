/**
 * Batch 3.2C — reconcile CRM MRR for the three paid disposable TEST fixtures
 * without sending founder notification emails.
 *
 * Usage (Sandbox secrets loaded in env):
 *   npx tsx scripts/qa/reconcile-b32c-mrr.mts
 */
import Stripe from "stripe";

import {
  couponIdsFromSubscription,
  mrrCentsFromStripeSubscription,
  summarizeRecurringDiscount,
  type RecurringCouponLike,
} from "../../marketing/lib/stripe/mrr";
import { syncSubscriptionLifecycleToRelationship } from "../../marketing/lib/relationships/bridge";

const FIXTURES = [
  {
    label: "A",
    subscriptionId: "sub_1Ueha9ErUqJH7nktBsRDUa6i",
    expectedMrrCents: 19900,
  },
  {
    label: "B",
    subscriptionId: "sub_1UehbdErUqJH7nktFuFqpGX7",
    expectedMrrCents: 15920,
  },
  {
    label: "C",
    subscriptionId: "sub_1Uehd3ErUqJH7nktKUkO28Vb",
    expectedMrrCents: 17910,
  },
] as const;

async function main() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key?.startsWith("sk_test_")) {
    throw new Error("STRIPE_SECRET_KEY must be a Stripe TEST secret key");
  }
  const stripe = new Stripe(key);

  const results = [];
  for (const fixture of FIXTURES) {
    const subscription = await stripe.subscriptions.retrieve(
      fixture.subscriptionId,
      { expand: ["items.data.price", "discounts"] },
    );
    const couponsById: Record<string, RecurringCouponLike> = {};
    for (const couponId of couponIdsFromSubscription(subscription)) {
      const coupon = await stripe.coupons.retrieve(couponId, {
        expand: ["applies_to"],
      });
      couponsById[couponId] = {
        id: coupon.id,
        name: coupon.name,
        percent_off: coupon.percent_off,
        amount_off: coupon.amount_off,
        applies_to: coupon.applies_to ?? null,
        valid: coupon.valid,
      };
    }
    const mrrCents = mrrCentsFromStripeSubscription(subscription, couponsById);
    const discount = summarizeRecurringDiscount(subscription, couponsById);
    if (mrrCents !== fixture.expectedMrrCents) {
      throw new Error(
        `${fixture.label}: computed MRR ${mrrCents} !== expected ${fixture.expectedMrrCents}`,
      );
    }

    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer?.id ?? null;
    const meta = subscription.metadata ?? {};

    await syncSubscriptionLifecycleToRelationship({
      email: null,
      venueName: meta.venue_name?.trim() || null,
      plan: meta.plan_tier ?? meta.htc_plan ?? null,
      planName: meta.plan_name?.trim() || null,
      foundingMember:
        meta.founding_member === "true"
          ? true
          : meta.founding_member === "false"
            ? false
            : undefined,
      welcomeBackRequested:
        meta.welcome_back === "true"
          ? true
          : meta.welcome_back === "false"
            ? false
            : undefined,
      onboardingType:
        meta.onboarding_type === "white_glove"
          ? "white_glove"
          : meta.onboarding_type
            ? "self_guided"
            : null,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId,
      mrrCents,
      stripeStatus: subscription.status,
      deleted: false,
      allowCreate: false,
    });

    results.push({
      label: fixture.label,
      subscriptionId: fixture.subscriptionId,
      mrrCents,
      discountName: discount?.name ?? null,
      status: subscription.status,
      livemode: subscription.livemode,
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        combinedMrrCents: results.reduce((sum, r) => sum + r.mrrCents, 0),
        results,
        note: "CRM subscriptions updated via lifecycle ingest; no founder emails sent",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
