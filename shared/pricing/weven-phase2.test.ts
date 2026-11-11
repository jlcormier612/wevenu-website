/**
 * Phase 2 — Former Weven Customer offer (local unit coverage).
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { selectBestOffer } from "./best-offer";
import {
  WEVEN_PERCENT_OFF,
  WEVEN_WHITE_GLOVE_AMOUNT_CENTS,
  WHITE_GLOVE_AMOUNT_CENTS,
  wevenAmountCents,
} from "./catalog";
import {
  createMemoryPricingOfferStore,
  setPricingOfferStoreForTests,
} from "./offer-store";
import {
  getPricingWevenV1Readiness,
  isPricingLaunchV1Ready,
  isPricingWevenV1Misconfigured,
  isPricingWevenV1Ready,
} from "./readiness";
import { resolveLaunchCheckoutPricing } from "./resolve-checkout";

const ENV_KEYS = [
  "PRICING_LAUNCH_V1",
  "PRICING_WEVEN_V1",
  "STRIPE_PRICE_GATHER_199",
  "STRIPE_PRICE_GROWING",
  "STRIPE_PRICE_PROFESSIONAL",
  "STRIPE_FOUNDING_PERCENT_COUPON_ID",
  "STRIPE_WEVEN_PERCENT_COUPON_ID",
  "STRIPE_PRICE_WHITE_GLOVE_WEVEN",
  "STRIPE_PRICE_WHITE_GLOVE",
] as const;

const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

function stashEnv() {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
}

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  setPricingOfferStoreForTests(null);
}

afterEach(() => {
  restoreEnv();
});

function enableLaunchV1() {
  process.env.PRICING_LAUNCH_V1 = "true";
  process.env.STRIPE_PRICE_GATHER_199 = "price_gather_199";
  process.env.STRIPE_PRICE_GROWING = "price_celebrate_249";
  process.env.STRIPE_PRICE_PROFESSIONAL = "price_flourish_349";
  process.env.STRIPE_FOUNDING_PERCENT_COUPON_ID = "coupon_founding_10";
  process.env.STRIPE_PRICE_WHITE_GLOVE = "price_wg_499";
}

function enableWevenReady() {
  process.env.PRICING_WEVEN_V1 = "true";
  process.env.STRIPE_WEVEN_PERCENT_COUPON_ID = "coupon_weven_20";
  process.env.STRIPE_PRICE_WHITE_GLOVE_WEVEN = "price_wg_weven_399";
}

describe("Phase 2 Weven catalog amounts", () => {
  it("computes 20% forever subscription totals for all tiers", () => {
    assert.equal(WEVEN_PERCENT_OFF, 20);
    assert.equal(wevenAmountCents("starter"), 15920);
    assert.equal(wevenAmountCents("growing"), 19920);
    assert.equal(wevenAmountCents("professional"), 27920);
    assert.equal(WEVEN_WHITE_GLOVE_AMOUNT_CENTS, 39900);
    assert.equal(WHITE_GLOVE_AMOUNT_CENTS, 49900);
  });
});

describe("Phase 2 Weven readiness gate", () => {
  it("stays disabled by default without advertising Weven Checkout", () => {
    stashEnv();
    enableLaunchV1();
    const readiness = getPricingWevenV1Readiness();
    assert.equal(readiness.mode, "disabled");
    assert.equal(isPricingWevenV1Ready(), false);
    assert.equal(isPricingLaunchV1Ready(), true);
  });

  it("is weven_misconfigured when flag is on but Stripe IDs missing", () => {
    stashEnv();
    enableLaunchV1();
    process.env.PRICING_WEVEN_V1 = "true";
    const readiness = getPricingWevenV1Readiness();
    assert.equal(readiness.mode, "weven_misconfigured");
    assert.equal(isPricingWevenV1Misconfigured(), true);
    assert.ok(readiness.missing.includes("STRIPE_WEVEN_PERCENT_COUPON_ID"));
    assert.ok(readiness.missing.includes("STRIPE_PRICE_WHITE_GLOVE_WEVEN"));
    // V1 remains healthy independently.
    assert.equal(isPricingLaunchV1Ready(), true);
  });

  it("is weven_ready when coupon + WG Price are configured", () => {
    stashEnv();
    enableLaunchV1();
    enableWevenReady();
    assert.equal(isPricingWevenV1Ready(), true);
    assert.equal(getPricingWevenV1Readiness().wevenPercentCouponId, "coupon_weven_20");
  });
});

describe("Phase 2 Weven checkout resolution", () => {
  it("applies Weven 20% immediately on trust-first self-declare (beats Founding)", () => {
    stashEnv();
    enableLaunchV1();
    enableWevenReady();
    const pricing = resolveLaunchCheckoutPricing({
      plan: "starter",
      earnedFoundingVenueCount: 62,
      wevenDeclared: true,
      wevenVerified: false,
    });
    assert.equal(pricing.mode, "launch_weven_percent");
    assert.equal(pricing.foundingCouponId, "coupon_weven_20");
    assert.equal(pricing.wevenDeclared, true);
    assert.equal(pricing.appliedOfferType, "weven_pct");
    assert.equal(pricing.foundingIssued, true);
  });

  it("applies Weven 20% on declare and keeps foundingIssued when under soft-100", () => {
    stashEnv();
    enableLaunchV1();
    enableWevenReady();
    const pricing = resolveLaunchCheckoutPricing({
      plan: "starter",
      earnedFoundingVenueCount: 62,
      wevenDeclared: true,
      wevenVerified: true,
    });
    assert.equal(pricing.mode, "launch_weven_percent");
    assert.equal(pricing.priceId, "price_gather_199");
    assert.equal(pricing.foundingCouponId, "coupon_weven_20");
    assert.equal(pricing.wevenDeclared, true);
    assert.equal(pricing.wevenPercentOff, 20);
    assert.equal(pricing.appliedOfferType, "weven_pct");
    assert.equal(pricing.foundingIssued, true);
    assert.equal(pricing.foundingPercentOff, 10);
    assert.equal(pricing.wevenWhiteGlovePriceId, "price_wg_weven_399");
  });

  it("covers Celebrate and Flourish Weven list Prices on declare", () => {
    stashEnv();
    enableLaunchV1();
    enableWevenReady();
    const celebrate = resolveLaunchCheckoutPricing({
      plan: "growing",
      earnedFoundingVenueCount: 10,
      wevenDeclared: true,
    });
    const flourish = resolveLaunchCheckoutPricing({
      plan: "professional",
      earnedFoundingVenueCount: 10,
      wevenDeclared: true,
    });
    assert.equal(celebrate.priceId, "price_celebrate_249");
    assert.equal(flourish.priceId, "price_flourish_349");
    assert.equal(celebrate.foundingCouponId, "coupon_weven_20");
    assert.equal(flourish.foundingCouponId, "coupon_weven_20");
  });

  it("does not issue Founding when soft-100 already reached but still applies declared Weven 20%", () => {
    stashEnv();
    enableLaunchV1();
    enableWevenReady();
    const pricing = resolveLaunchCheckoutPricing({
      plan: "starter",
      earnedFoundingVenueCount: 100,
      wevenDeclared: true,
    });
    assert.equal(pricing.mode, "launch_weven_percent");
    assert.equal(pricing.foundingIssued, false);
    assert.equal(pricing.appliedOfferType, "weven_pct");
    assert.equal(pricing.foundingCouponId, "coupon_weven_20");
  });

  it("fails closed when Weven is declared but misconfigured", () => {
    stashEnv();
    enableLaunchV1();
    process.env.PRICING_WEVEN_V1 = "true";
    assert.throws(
      () =>
        resolveLaunchCheckoutPricing({
          plan: "starter",
          earnedFoundingVenueCount: 0,
          wevenDeclared: true,
        }),
      /incomplete|missing|Weven/i,
    );
    // Standard founding path still works.
    const founding = resolveLaunchCheckoutPricing({
      plan: "starter",
      earnedFoundingVenueCount: 0,
      wevenDeclared: false,
    });
    assert.equal(founding.mode, "launch_founding_percent");
    assert.equal(founding.foundingCouponId, "coupon_founding_10");
  });

  it("ignores Weven declaration when Phase 2 is disabled — V1 founding unchanged", () => {
    stashEnv();
    enableLaunchV1();
    const pricing = resolveLaunchCheckoutPricing({
      plan: "starter",
      earnedFoundingVenueCount: 0,
      wevenDeclared: true,
    });
    assert.equal(pricing.mode, "launch_founding_percent");
    assert.equal(pricing.foundingCouponId, "coupon_founding_10");
    assert.equal(pricing.wevenDeclared, false);
  });
});

describe("Phase 2 Weven grants, claims, and verification", () => {
  it("earns both Weven and Founding grants; best offer applies Weven only", async () => {
    stashEnv();
    const store = createMemoryPricingOfferStore();
    setPricingOfferStoreForTests(store);

    const offer = await store.issueCheckoutOffer({
      planKey: "starter",
      listAmountCents: 19900,
      stripePriceId: "price_gather_199",
      foundingIssued: true,
      foundingPercentOff: 10,
      wevenDeclared: true,
      wevenPercentOff: 20,
      appliedOfferType: "weven_pct",
      stripeCouponId: "coupon_weven_20",
      whiteGlovePriceId: "price_wg_weven_399",
      pricingVersion: "v1",
      earnedFoundingCountAtIssue: 62,
    });
    await store.attachCheckoutSession(offer.id, "cs_weven_1");
    await store.markOfferStatus(offer.id, "paid", {
      paidAt: new Date().toISOString(),
    });

    const founding = await store.earnFoundingGrant({
      offerId: offer.id,
      checkoutSessionId: "cs_weven_1",
      percentOff: 10,
    });
    const weven = await store.earnWevenGrant({
      offerId: offer.id,
      checkoutSessionId: "cs_weven_1",
      percentOff: 20,
    });
    assert.equal(founding.created, true);
    assert.equal(weven.created, true);

    const claim = await store.upsertWevenClaim({
      checkoutSessionId: "cs_weven_1",
      checkoutOfferId: offer.id,
      stripeSubscriptionId: "sub_weven_1",
      grantId: weven.grant.id,
      appliedOfferType: "weven_pct",
      appliedPercentOff: 20,
      foundingAlsoEarned: true,
      ownerEmailNormalized: "owner@example.com",
      venueNameNormalized: "garden venue",
    });
    assert.equal(claim.reviewStatus, "pending");
    assert.equal(claim.foundingAlsoEarned, true);

    // Duplicate webhook / checkout retry is idempotent.
    const claim2 = await store.upsertWevenClaim({
      checkoutSessionId: "cs_weven_1",
      checkoutOfferId: offer.id,
      foundingAlsoEarned: true,
    });
    assert.equal(claim2.id, claim.id);
    const wevenDup = await store.earnWevenGrant({
      offerId: offer.id,
      checkoutSessionId: "cs_weven_1",
      percentOff: 20,
    });
    assert.equal(wevenDup.created, false);
    assert.equal(wevenDup.grant.id, weven.grant.id);

    const bound = await store.bindAllGrantsForSession("cs_weven_1", "venue_a");
    assert.equal(bound.length, 2);
    const grants = await store.listEarnedGrantsForVenue("venue_a");
    assert.equal(grants.length, 2);
    const best = selectBestOffer({
      listAmountCents: 19900,
      grants: grants.map((g) => ({
        id: g.id,
        offerType: g.offerType,
        percentOff: g.percentOff,
        status: g.status as "earned" | "revoked_prospective",
      })),
    });
    assert.equal(best.offerType, "weven_pct");
    assert.equal(best.percentOff, 20);
    assert.equal(best.expectedAmountCents, 15920);

    // Second venue under same owner can have independent eligibility.
    const offerB = await store.issueCheckoutOffer({
      planKey: "growing",
      listAmountCents: 24900,
      stripePriceId: "price_celebrate_249",
      foundingIssued: true,
      foundingPercentOff: 10,
      wevenDeclared: false,
      wevenPercentOff: null,
      appliedOfferType: "founding_pct",
      stripeCouponId: "coupon_founding_10",
      pricingVersion: "v1",
      ownerEmailNormalized: "owner@example.com",
      venueNameNormalized: "barn venue",
    });
    await store.attachCheckoutSession(offerB.id, "cs_founding_b");
    await store.earnFoundingGrant({
      offerId: offerB.id,
      checkoutSessionId: "cs_founding_b",
      percentOff: 10,
    });
    await store.bindAllGrantsForSession("cs_founding_b", "venue_b");
    const grantsB = await store.listEarnedGrantsForVenue("venue_b");
    assert.equal(grantsB.length, 1);
    assert.equal(grantsB[0]?.offerType, "founding_pct");
    const grantsA = await store.listEarnedGrantsForVenue("venue_a");
    assert.equal(grantsA.length, 2);

    // Not-eligible verification does not authorize Stripe billing changes.
    await assert.rejects(
      () =>
        store.updateWevenClaimReview({
          claimId: claim.id,
          reviewStatus: "not_eligible",
          reviewedBy: "founder_1",
          billingActionAuthorized: true,
        }),
      /separately authorized|must not change Stripe/i,
    );
    const reviewed = await store.updateWevenClaimReview({
      claimId: claim.id,
      reviewStatus: "not_eligible",
      reviewedBy: "founder_1",
      note: "No legacy match — record only",
      billingActionAuthorized: false,
    });
    assert.equal(reviewed.reviewStatus, "not_eligible");
    assert.equal(reviewed.decisionHistory.length, 1);
    assert.equal(reviewed.decisionHistory[0]?.billingActionAuthorized, false);
    // Founding grant remains for future billing correction policy.
    assert.equal(
      (await store.listEarnedGrantsForVenue("venue_a")).some(
        (g) => g.offerType === "founding_pct",
      ),
      true,
    );
  });

  it("pending Weven verification still allows venue grant binding (activation)", async () => {
    stashEnv();
    const store = createMemoryPricingOfferStore();
    const offer = await store.issueCheckoutOffer({
      planKey: "starter",
      listAmountCents: 19900,
      stripePriceId: "price_gather_199",
      foundingIssued: false,
      foundingPercentOff: null,
      wevenDeclared: true,
      wevenPercentOff: 20,
      appliedOfferType: "weven_pct",
      stripeCouponId: "coupon_weven_20",
      pricingVersion: "v1",
    });
    await store.attachCheckoutSession(offer.id, "cs_pending");
    await store.earnWevenGrant({
      offerId: offer.id,
      checkoutSessionId: "cs_pending",
      percentOff: 20,
    });
    await store.upsertWevenClaim({
      checkoutSessionId: "cs_pending",
      appliedOfferType: "weven_pct",
      appliedPercentOff: 20,
    });
    const bound = await store.bindAllGrantsForSession("cs_pending", "venue_pending");
    assert.equal(bound.length, 1);
    assert.equal(bound[0]?.venueId, "venue_pending");
    const claim = await store.getWevenClaimBySessionId("cs_pending");
    assert.equal(claim?.reviewStatus, "pending");
    assert.equal(claim?.venueId, "venue_pending");
  });
});
