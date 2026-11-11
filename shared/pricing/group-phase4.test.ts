import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { selectBestOffer } from "./best-offer";
import {
  groupAmountCents,
  GROUP_PERCENT_OFF,
  foundingAmountCents,
  wevenAmountCents,
} from "./catalog";
import {
  decideGroupBillingAdjustment,
  grantsWithGroupEligibility,
  previewGroupRecurringAmountCents,
} from "./group-billing-reconcile";
import {
  evaluateGroupEligibility,
  shouldRequireMembershipReview,
  venueCountsTowardGroupEligibility,
} from "./group-eligibility";
import {
  fulfillOrganizationVenueActivation,
  resolveReservationGroupEligibility,
} from "./group-fulfillment";
import {
  createMemoryGroupOrgStore,
  resetGroupOrgStoreForTests,
  setGroupOrgStoreForTests,
} from "./group-org-store";
import { executeGroupCouponChange } from "./group-stripe-execute";
import { resolveLaunchCheckoutPricing } from "./resolve-checkout";
import type { TierUpgradeRecord } from "./tier-upgrade-types";

const PREV_ENV: Record<string, string | undefined> = {};
const ENV_KEYS = [
  "PRICING_LAUNCH_V1",
  "PRICING_WEVEN_V1",
  "PRICING_GROUP_V1",
  "STRIPE_PRICE_GATHER_199",
  "STRIPE_PRICE_GROWING",
  "STRIPE_PRICE_PROFESSIONAL",
  "STRIPE_FOUNDING_PERCENT_COUPON_ID",
  "STRIPE_WEVEN_PERCENT_COUPON_ID",
  "STRIPE_PRICE_WHITE_GLOVE_WEVEN",
  "STRIPE_GROUP_PERCENT_COUPON_ID",
];

function setLaunchReady() {
  process.env.PRICING_LAUNCH_V1 = "true";
  process.env.STRIPE_PRICE_GATHER_199 = "price_gather";
  process.env.STRIPE_PRICE_GROWING = "price_celebrate";
  process.env.STRIPE_PRICE_PROFESSIONAL = "price_flourish";
  process.env.STRIPE_FOUNDING_PERCENT_COUPON_ID = "coupon_founding_10";
}

describe("Phase 4 group eligibility", () => {
  it("does not count spaces — only active memberships with qualifying subs", () => {
    assert.equal(
      venueCountsTowardGroupEligibility({
        venueId: "v1",
        membershipStatus: "active",
        subscriptionStatus: "active",
      }),
      true,
    );
    assert.equal(
      venueCountsTowardGroupEligibility({
        venueId: "v1",
        membershipStatus: "active",
        subscriptionStatus: "canceled",
      }),
      false,
    );
    assert.equal(
      venueCountsTowardGroupEligibility({
        venueId: "v1",
        membershipStatus: "pending_review",
        subscriptionStatus: "active",
      }),
      false,
    );
  });

  it("keeps past_due as qualifying during dunning", () => {
    assert.equal(
      venueCountsTowardGroupEligibility({
        venueId: "v1",
        membershipStatus: "active",
        subscriptionStatus: "past_due",
      }),
      true,
    );
  });

  it("requires two qualifying venues for group eligibility", () => {
    const one = evaluateGroupEligibility({
      members: [
        {
          venueId: "a",
          membershipStatus: "active",
          subscriptionStatus: "active",
        },
      ],
    });
    assert.equal(one.groupEligible, false);
    assert.equal(one.groupEligibleForCheckout, false);

    const two = evaluateGroupEligibility({
      members: [
        {
          venueId: "a",
          membershipStatus: "active",
          subscriptionStatus: "active",
        },
        {
          venueId: "b",
          membershipStatus: "active",
          subscriptionStatus: "trialing",
        },
      ],
    });
    assert.equal(two.groupEligible, true);
    assert.equal(two.qualifyingVenueCount, 2);
  });

  it("Checkout reservation bridges second-venue group pricing without charging venue 1 midcycle", () => {
    const evaled = evaluateGroupEligibility({
      members: [
        {
          venueId: "a",
          membershipStatus: "active",
          subscriptionStatus: "active",
        },
      ],
      reservations: [
        {
          id: "r1",
          organizationId: "org",
          sourceVenueId: "a",
          checkoutOfferId: null,
          stripeCheckoutSessionId: null,
          status: "reserved",
          countsTowardEligibility: true,
          planKey: "starter",
          expiresAt: null,
          fulfilledVenueId: null,
          fulfilledAt: null,
          releasedAt: null,
          releaseReason: null,
          createdByUserId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
    assert.equal(evaled.groupEligible, false);
    assert.equal(evaled.groupEligibleForCheckout, true);
  });

  it("flags duplicate property names for founder review", () => {
    const review = shouldRequireMembershipReview({
      proposedVenueNameNormalized: "willow grove",
      existingMemberVenueNamesNormalized: ["Willow Grove"],
    });
    assert.equal(review.reviewRequired, true);
  });

  it("same owner email without membership never implies organization", () => {
    // Pure documentation of the invariant — eligibility only sees membership inputs.
    const evaled = evaluateGroupEligibility({
      members: [],
    });
    assert.equal(evaled.groupEligible, false);
    assert.equal(evaled.qualifyingVenueCount, 0);
  });
});

describe("Phase 4 best-offer + amounts", () => {
  it("applies catalog group amounts", () => {
    assert.equal(groupAmountCents("starter"), 17910);
    assert.equal(groupAmountCents("growing"), 22410);
    assert.equal(groupAmountCents("professional"), 31410);
  });

  it("Group only → 10%; Weven beats Group; Founding beats Group at equal 10%", () => {
    const groupOnly = selectBestOffer({
      listAmountCents: 19900,
      grants: grantsWithGroupEligibility({
        grants: [],
        groupEligible: true,
      }),
    });
    assert.equal(groupOnly.offerType, "group_pct");
    assert.equal(groupOnly.expectedAmountCents, 17910);

    const withWeven = selectBestOffer({
      listAmountCents: 24900,
      grants: grantsWithGroupEligibility({
        grants: [
          {
            id: "w",
            offerType: "weven_pct",
            percentOff: 20,
            status: "earned",
          },
        ],
        groupEligible: true,
      }),
    });
    assert.equal(withWeven.offerType, "weven_pct");
    assert.equal(withWeven.expectedAmountCents, wevenAmountCents("growing"));

    const withFounding = selectBestOffer({
      listAmountCents: 19900,
      grants: grantsWithGroupEligibility({
        grants: [
          {
            id: "f",
            offerType: "founding_pct",
            percentOff: 10,
            status: "earned",
          },
        ],
        groupEligible: true,
      }),
    });
    assert.equal(withFounding.offerType, "founding_pct");
    assert.equal(withFounding.expectedAmountCents, foundingAmountCents("starter"));
  });

  it("Group + Founding + Weven → Weven 20%", () => {
    const all = selectBestOffer({
      listAmountCents: 34900,
      grants: grantsWithGroupEligibility({
        grants: [
          {
            id: "f",
            offerType: "founding_pct",
            percentOff: 10,
            status: "earned",
          },
          {
            id: "w",
            offerType: "weven_pct",
            percentOff: 20,
            status: "earned",
          },
        ],
        groupEligible: true,
      }),
    });
    assert.equal(all.offerType, "weven_pct");
    assert.equal(all.percentOff, 20);
  });
});

describe("Phase 4 Checkout resolution", () => {
  beforeEach(() => {
    for (const k of ENV_KEYS) PREV_ENV[k] = process.env[k];
    setLaunchReady();
    process.env.PRICING_GROUP_V1 = "true";
    process.env.STRIPE_GROUP_PERCENT_COUPON_ID = "coupon_group_10";
    delete process.env.PRICING_WEVEN_V1;
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (PREV_ENV[k] === undefined) delete process.env[k];
      else process.env[k] = PREV_ENV[k];
    }
  });

  it("second-venue Checkout uses group 10% when reservation bridges eligibility", () => {
    const pricing = resolveLaunchCheckoutPricing({
      plan: "starter",
      earnedFoundingVenueCount: 100,
      groupEligible: true,
    });
    assert.equal(pricing.appliedOfferType, "group_pct");
    assert.equal(pricing.mode, "launch_group_percent");
    assert.equal(pricing.foundingCouponId, "coupon_group_10");
    assert.equal(pricing.expectedRecurringAmountCents, 17910);
    assert.equal(pricing.groupPercentOff, GROUP_PERCENT_OFF);
  });

  it("Add Another Venue suppresses Founding so Group coupon applies while soft-100 remains", () => {
    const pricing = resolveLaunchCheckoutPricing({
      plan: "starter",
      earnedFoundingVenueCount: 10,
      groupEligible: true,
      honorFoundingIssued: false,
    });
    assert.equal(pricing.appliedOfferType, "group_pct");
    assert.equal(pricing.mode, "launch_group_percent");
    assert.equal(pricing.foundingIssued, false);
    assert.equal(pricing.foundingCouponId, "coupon_group_10");
    assert.equal(pricing.expectedRecurringAmountCents, 17910);
  });

  it("Founding still wins over Group at Checkout when both apply", () => {
    const pricing = resolveLaunchCheckoutPricing({
      plan: "growing",
      earnedFoundingVenueCount: 10,
      groupEligible: true,
    });
    assert.equal(pricing.appliedOfferType, "founding_pct");
    assert.equal(pricing.expectedRecurringAmountCents, 22410);
    assert.equal(pricing.groupEligible, true);
  });

  it("Weven wins over Group at Checkout", () => {
    process.env.PRICING_WEVEN_V1 = "true";
    process.env.STRIPE_WEVEN_PERCENT_COUPON_ID = "coupon_weven_20";
    process.env.STRIPE_PRICE_WHITE_GLOVE_WEVEN = "price_wg_weven";
    const pricing = resolveLaunchCheckoutPricing({
      plan: "professional",
      earnedFoundingVenueCount: 10,
      wevenDeclared: true,
      wevenVerified: true,
      groupEligible: true,
    });
    assert.equal(pricing.appliedOfferType, "weven_pct");
    assert.equal(pricing.expectedRecurringAmountCents, wevenAmountCents("professional"));
  });
});

describe("Phase 4 billing reconcile + Phase 3 safety", () => {
  beforeEach(() => {
    for (const k of ENV_KEYS) PREV_ENV[k] = process.env[k];
    process.env.STRIPE_GROUP_PERCENT_COUPON_ID = "coupon_group_10";
    process.env.STRIPE_FOUNDING_PERCENT_COUPON_ID = "coupon_founding_10";
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (PREV_ENV[k] === undefined) delete process.env[k];
      else process.env[k] = PREV_ENV[k];
    }
  });

  it("defers coupon mutation when an HTC tier-upgrade schedule is active", () => {
    const pending = {
      id: "up-1",
      status: "scheduled",
    } as TierUpgradeRecord;
    const decision = decideGroupBillingAdjustment({
      venueId: "v1",
      organizationId: "org",
      planKey: "starter",
      stripeSubscriptionId: "sub_1",
      grants: [],
      groupEligible: true,
      pendingTierUpgrade: pending,
      currentAppliedOfferType: null,
      currentStripeCouponId: null,
    });
    assert.equal(decision.action, "defer_to_schedule");
    assert.equal(decision.desiredOfferType, "group_pct");
    if (decision.action === "defer_to_schedule") {
      assert.equal(decision.relatedTierUpgradeId, "up-1");
      assert.equal(decision.schedulePreserveCouponId, "coupon_group_10");
    }
  });

  it("applies group prospectively when no schedule owns the subscription", () => {
    const decision = decideGroupBillingAdjustment({
      venueId: "v1",
      organizationId: "org",
      planKey: "growing",
      stripeSubscriptionId: "sub_1",
      grants: [],
      groupEligible: true,
      pendingTierUpgrade: null,
      currentAppliedOfferType: null,
    });
    assert.equal(decision.action, "apply_coupon");
    assert.equal(decision.expectedRecurringAmountCents, 22410);
  });

  it("removes group prospectively and preserves Founding grant", () => {
    const decision = decideGroupBillingAdjustment({
      venueId: "v1",
      organizationId: "org",
      planKey: "starter",
      stripeSubscriptionId: "sub_1",
      grants: [
        {
          id: "f",
          offerType: "founding_pct",
          percentOff: 10,
          status: "earned",
        },
      ],
      groupEligible: false,
      pendingTierUpgrade: null,
      currentAppliedOfferType: "group_pct",
      currentStripeCouponId: "coupon_group_10",
    });
    assert.equal(decision.action, "apply_coupon");
    assert.equal(decision.desiredOfferType, "founding_pct");
  });

  it("tier upgrade amount previews with group", () => {
    assert.equal(
      previewGroupRecurringAmountCents({
        planKey: "growing",
        groupEligible: true,
      }),
      22410,
    );
    assert.equal(
      previewGroupRecurringAmountCents({
        planKey: "professional",
        groupEligible: true,
      }),
      31410,
    );
    assert.equal(
      previewGroupRecurringAmountCents({
        planKey: "growing",
        groupEligible: true,
        hasWeven: true,
      }),
      wevenAmountCents("growing"),
    );
  });
});

describe("Phase 4 organization store lifecycle", () => {
  beforeEach(() => {
    const store = createMemoryGroupOrgStore();
    setGroupOrgStoreForTests(store);
  });
  afterEach(() => {
    resetGroupOrgStoreForTests();
  });

  it("enforces one active billing org per venue and reservation fulfill/release", async () => {
    const store = createMemoryGroupOrgStore();
    const org = await store.createOrganization({ name: "Acme Venues" });
    await store.addMembership({
      organizationId: org.id,
      venueId: "venue-a",
      role: "primary",
    });
    await assert.rejects(
      () =>
        store.addMembership({
          organizationId: org.id,
          venueId: "venue-a",
        }),
      /already has an active billing organization/,
    );

    const reservation = await store.createCheckoutReservation({
      organizationId: org.id,
      sourceVenueId: "venue-a",
      planKey: "starter",
    });
    assert.equal(reservation.status, "reserved");

    const fulfilled = await store.fulfillReservation({
      reservationId: reservation.id,
      venueId: "venue-b",
    });
    assert.equal(fulfilled.status, "fulfilled");

    const r2 = await store.createCheckoutReservation({
      organizationId: org.id,
      sourceVenueId: "venue-a",
    });
    const released = await store.releaseReservation(r2.id, "checkout_abandoned");
    assert.equal(released.status, "released");
    assert.equal(released.countsTowardEligibility, false);
  });

  it("does not release a reservation that still has a payable Checkout Session", async () => {
    const store = createMemoryGroupOrgStore();
    const org = await store.createOrganization({ name: "Hold Open" });
    const reservation = await store.createCheckoutReservation({
      organizationId: org.id,
      sourceVenueId: "venue-a",
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    await store.attachCheckoutSession({
      reservationId: reservation.id,
      stripeCheckoutSessionId: "cs_test_open",
    });
    const held = await store.releaseReservation(reservation.id, "expired");
    assert.equal(held.status, "reserved");
    assert.equal(held.stripeCheckoutSessionId, "cs_test_open");
  });

  it("fulfills activation idempotently and queues prospective adjustments", async () => {
    process.env.PRICING_GROUP_V1 = "true";
    process.env.STRIPE_GROUP_PERCENT_COUPON_ID = "coupon_group_10";
    const store = createMemoryGroupOrgStore();
    const org = await store.createOrganization({ name: "Two Props" });
    await store.addMembership({
      organizationId: org.id,
      venueId: "venue-a",
      role: "primary",
    });
    const reservation = await store.createCheckoutReservation({
      organizationId: org.id,
      sourceVenueId: "venue-a",
      planKey: "starter",
    });
    await store.attachCheckoutSession({
      reservationId: reservation.id,
      stripeCheckoutSessionId: "cs_test_b",
    });

    const loadMemberBilling = async (venueIds: string[]) =>
      venueIds.map((venueId) => ({
        venueId,
        planKey: "starter" as const,
        subscriptionStatus: "active",
        stripeSubscriptionId: venueId === "venue-a" ? "sub_a" : "sub_b",
        grants: [],
        pendingTierUpgrade: null,
        currentAppliedOfferType: null,
        currentStripeCouponId: null,
      }));

    const first = await fulfillOrganizationVenueActivation({
      store,
      reservationId: reservation.id,
      checkoutSessionId: "cs_test_b",
      venueId: "venue-b",
      loadMemberBilling,
    });
    assert.equal(first.groupEligible, true);
    assert.equal(first.membership?.venueId, "venue-b");
    // Approved policy: first/anchor venue does not receive a retroactive
    // group discount when an additional venue joins. Checkout already applied
    // the winning coupon to venue-b, so no prospective adjustments are queued.
    assert.equal(first.adjustments.length, 0);

    const second = await fulfillOrganizationVenueActivation({
      store,
      reservationId: reservation.id,
      checkoutSessionId: "cs_test_b",
      venueId: "venue-b",
      loadMemberBilling,
    });
    assert.equal(second.reservation?.status, "fulfilled");
    // Idempotent — no duplicate membership.
    const members = await store.listMembershipsForOrg(org.id);
    assert.equal(members.filter((m) => m.venueId === "venue-b").length, 1);
  });

  it("resolves Checkout group eligibility from durable reservation only", async () => {
    const store = createMemoryGroupOrgStore();
    const org = await store.createOrganization({ name: "Bridge" });
    await store.addMembership({
      organizationId: org.id,
      venueId: "venue-a",
    });
    const reservation = await store.createCheckoutReservation({
      organizationId: org.id,
      sourceVenueId: "venue-a",
    });
    const resolved = await resolveReservationGroupEligibility({
      store,
      reservationId: reservation.id,
      loadMemberBilling: async () => [
        {
          venueId: "venue-a",
          planKey: "starter",
          subscriptionStatus: "active",
          stripeSubscriptionId: "sub_a",
        },
      ],
    });
    assert.equal(resolved.groupEligibleForCheckout, true);
    assert.equal(resolved.groupEligible, false);
  });
});

describe("Phase 4 Stripe group coupon executor", () => {
  it("refuses independent mutation when a schedule is attached", async () => {
    const stripe = {
      subscriptions: {
        async retrieve() {
          return { id: "sub_1", schedule: "sub_sched_1", discounts: [] };
        },
        async update() {
          throw new Error("should not update");
        },
      },
    };
    const result = await executeGroupCouponChange({
      stripe,
      subscriptionId: "sub_1",
      decision: {
        action: "apply_coupon",
        reason: "test",
        desiredOfferType: "group_pct",
        desiredPercentOff: 10,
        desiredStripeCouponId: "coupon_group_10",
        expectedRecurringAmountCents: 17910,
        relatedTierUpgradeId: null,
        schedulePreserveCouponId: null,
      },
      idempotencyKey: "test-key",
    });
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /schedule/i);
  });

  it("applies coupon with proration_behavior none and confirms", async () => {
    let updatedParams: Record<string, unknown> | null = null;
    const stripe = {
      subscriptions: {
        async retrieve() {
          return {
            id: "sub_1",
            schedule: null,
            discounts: updatedParams
              ? [{ coupon: "coupon_group_10" }]
              : [],
          };
        },
        async update(_id: string, params: Record<string, unknown>) {
          updatedParams = params;
          return {
            id: "sub_1",
            schedule: null,
            discounts: [{ coupon: "coupon_group_10" }],
          };
        },
      },
    };
    const result = await executeGroupCouponChange({
      stripe,
      subscriptionId: "sub_1",
      decision: {
        action: "apply_coupon",
        reason: "test",
        desiredOfferType: "group_pct",
        desiredPercentOff: 10,
        desiredStripeCouponId: "coupon_group_10",
        expectedRecurringAmountCents: 17910,
        relatedTierUpgradeId: null,
        schedulePreserveCouponId: null,
      },
      idempotencyKey: "apply-group",
    });
    assert.equal(result.ok, true);
    assert.equal(result.confirmedCouponId, "coupon_group_10");
    assert.equal(updatedParams?.proration_behavior, "none");
  });

  it("confirms coupons from expanded discounts[].source.coupon (API 2024+)", async () => {
    const retrieves: Array<string[] | undefined> = [];
    const stripe = {
      subscriptions: {
        async retrieve(_id: string, params?: { expand?: string[] }) {
          retrieves.push(params?.expand);
          return {
            id: "sub_1",
            schedule: null,
            // Mimic expanded Stripe discount shape after apply.
            discounts: [
              {
                id: "di_1",
                source: { coupon: "coupon_group_10", type: "coupon" },
              },
            ],
          };
        },
        async update(_id: string, params: Record<string, unknown>) {
          assert.equal(params.proration_behavior, "none");
          return { id: "sub_1", schedule: null, discounts: [] };
        },
      },
    };
    const result = await executeGroupCouponChange({
      stripe,
      subscriptionId: "sub_1",
      decision: {
        action: "apply_coupon",
        reason: "test",
        desiredOfferType: "group_pct",
        desiredPercentOff: 10,
        desiredStripeCouponId: "coupon_group_10",
        expectedRecurringAmountCents: 17910,
        relatedTierUpgradeId: null,
        schedulePreserveCouponId: null,
      },
      idempotencyKey: "apply-group-source",
    });
    assert.equal(result.ok, true);
    assert.equal(result.confirmedCouponId, "coupon_group_10");
    assert.ok(retrieves.every((e) => e?.includes("discounts")));
  });
});
