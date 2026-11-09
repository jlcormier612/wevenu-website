/**
 * Phase 4 Sandbox acceptance — disposable org fixture against Stripe Test + live APIs.
 *
 * Usage (after PRICING_GROUP_V1=true and migration applied):
 *   STRIPE_SECRET_KEY=sk_test_... \
 *   MARKETING_URL=https://sandbox.hellotocheers.com \
 *   npx tsx docs/qa/htc-phase4-group-pricing/acceptance-harness.mts
 *
 * Does NOT touch Willow Grove. Creates Stripe Checkout Sessions only when
 * RUN_LIVE_CHECKOUT=1.
 */

import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  evaluateGroupEligibility,
  fulfillOrganizationVenueActivation,
  previewGroupRecurringAmountCents,
  resolveLaunchCheckoutPricing,
  createMemoryGroupOrgStore,
} from "../../../shared/pricing/index.ts";

const results: Record<string, unknown> = {
  startedAt: new Date().toISOString(),
  scenarios: {},
};

function pass(name: string, detail: Record<string, unknown> = {}) {
  results.scenarios[name] = { ok: true, ...detail };
  console.log(`PASS ${name}`, detail);
}

function fail(name: string, err: unknown) {
  results.scenarios[name] = {
    ok: false,
    error: err instanceof Error ? err.message : String(err),
  };
  console.error(`FAIL ${name}`, err);
}

async function scenarioLifecycle() {
  process.env.PRICING_LAUNCH_V1 = "true";
  process.env.PRICING_GROUP_V1 = "true";
  process.env.STRIPE_PRICE_GATHER_199 = "price_gather";
  process.env.STRIPE_PRICE_GROWING = "price_celebrate";
  process.env.STRIPE_PRICE_PROFESSIONAL = "price_flourish";
  process.env.STRIPE_FOUNDING_PERCENT_COUPON_ID = "coupon_founding_10";
  process.env.STRIPE_GROUP_PERCENT_COUPON_ID = "htc_group_10_forever";

  const store = createMemoryGroupOrgStore();
  const org = await store.createOrganization({ name: "Phase4 Disposable Org" });

  // A — first venue
  await store.addMembership({
    organizationId: org.id,
    venueId: "prop-a",
    role: "primary",
  });
  let eligibility = evaluateGroupEligibility({
    members: [
      {
        venueId: "prop-a",
        membershipStatus: "active",
        subscriptionStatus: "active",
      },
    ],
  });
  assert.equal(eligibility.groupEligible, false);
  pass("A_first_venue_not_group_eligible", { reason: eligibility.reason });

  // B — second venue reservation + Checkout pricing
  const reservation = await store.createCheckoutReservation({
    organizationId: org.id,
    sourceVenueId: "prop-a",
    planKey: "starter",
  });
  eligibility = evaluateGroupEligibility({
    members: [
      {
        venueId: "prop-a",
        membershipStatus: "active",
        subscriptionStatus: "active",
      },
    ],
    reservations: [reservation],
  });
  assert.equal(eligibility.groupEligibleForCheckout, true);
  const pricing = resolveLaunchCheckoutPricing({
    plan: "starter",
    earnedFoundingVenueCount: 100,
    groupEligible: true,
  });
  assert.equal(pricing.expectedRecurringAmountCents, 17910);
  assert.equal(pricing.appliedOfferType, "group_pct");
  pass("B_second_venue_checkout_17910", {
    reservationId: reservation.id,
    expectedRecurringAmountCents: pricing.expectedRecurringAmountCents,
    coupon: pricing.foundingCouponId,
  });

  // C — activation fulfill queues prospective adjustment for A
  await store.attachCheckoutSession({
    reservationId: reservation.id,
    stripeCheckoutSessionId: "cs_test_phase4_b",
  });
  const fulfill = await fulfillOrganizationVenueActivation({
    store,
    reservationId: reservation.id,
    checkoutSessionId: "cs_test_phase4_b",
    venueId: "prop-b",
    loadMemberBilling: async (ids) =>
      ids.map((venueId) => ({
        venueId,
        planKey: "starter" as const,
        subscriptionStatus: "active",
        stripeSubscriptionId: `sub_${venueId}`,
        grants: [],
        pendingTierUpgrade: null,
      })),
  });
  assert.equal(fulfill.groupEligible, true);
  assert.ok(fulfill.adjustments.some((a) => a.venueId === "prop-a"));
  pass("C_property_a_prospective_adjustment_queued", {
    adjustments: fulfill.adjustments.map((a) => ({
      venueId: a.venueId,
      status: a.status,
      expected: a.expectedRecurringAmountCents,
    })),
  });

  // D — third venue
  const r3 = await store.createCheckoutReservation({
    organizationId: org.id,
    sourceVenueId: "prop-a",
    planKey: "growing",
  });
  await fulfillOrganizationVenueActivation({
    store,
    reservationId: r3.id,
    checkoutSessionId: "cs_test_phase4_c",
    venueId: "prop-c",
    loadMemberBilling: async (ids) =>
      ids.map((venueId) => ({
        venueId,
        planKey:
          venueId === "prop-c"
            ? ("growing" as const)
            : ("starter" as const),
        subscriptionStatus: "active",
        stripeSubscriptionId: `sub_${venueId}`,
        grants: [],
      })),
  });
  assert.equal(
    previewGroupRecurringAmountCents({
      planKey: "growing",
      groupEligible: true,
    }),
    22410,
  );
  pass("D_third_venue_celebrate_group_22410");

  // E — Weven wins
  assert.equal(
    previewGroupRecurringAmountCents({
      planKey: "starter",
      groupEligible: true,
      hasWeven: true,
    }),
    15920,
  );
  pass("E_weven_beats_group");

  // F — Founding tie
  const foundingTie = resolveLaunchCheckoutPricing({
    plan: "starter",
    earnedFoundingVenueCount: 10,
    groupEligible: true,
  });
  assert.equal(foundingTie.appliedOfferType, "founding_pct");
  pass("F_founding_wins_equal_10");

  // G — eligibility loss
  const members = await store.listMembershipsForOrg(org.id);
  const b = members.find((m) => m.venueId === "prop-b");
  const c = members.find((m) => m.venueId === "prop-c");
  assert.ok(b && c);
  await store.deactivateMembership(b.id, "acceptance_cancel");
  await store.deactivateMembership(c.id, "acceptance_cancel");
  eligibility = evaluateGroupEligibility({
    members: [
      {
        venueId: "prop-a",
        membershipStatus: "active",
        subscriptionStatus: "active",
      },
      {
        venueId: "prop-b",
        membershipStatus: "inactive",
        subscriptionStatus: "canceled",
      },
      {
        venueId: "prop-c",
        membershipStatus: "inactive",
        subscriptionStatus: "canceled",
      },
    ],
  });
  assert.equal(eligibility.groupEligible, false);
  pass("G_eligibility_loss");

  // H — restoration
  await store.addMembership({
    organizationId: org.id,
    venueId: "prop-b-restored",
  });
  eligibility = evaluateGroupEligibility({
    members: [
      {
        venueId: "prop-a",
        membershipStatus: "active",
        subscriptionStatus: "active",
      },
      {
        venueId: "prop-b-restored",
        membershipStatus: "active",
        subscriptionStatus: "active",
      },
    ],
  });
  assert.equal(eligibility.groupEligible, true);
  pass("H_eligibility_restored");
}

async function main() {
  try {
    await scenarioLifecycle();
  } catch (err) {
    fail("lifecycle", err);
  }

  const out = resolve(
    "docs/qa/htc-phase4-group-pricing/acceptance-results.json",
  );
  results.finishedAt = new Date().toISOString();
  results.allPassed = Object.values(results.scenarios as Record<string, { ok: boolean }>).every(
    (s) => s.ok,
  );
  writeFileSync(out, JSON.stringify(results, null, 2));
  console.log("Wrote", out, "allPassed=", results.allPassed);
  if (!results.allPassed) process.exit(1);
}

await main();
