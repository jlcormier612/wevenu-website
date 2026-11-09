import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { decideFoundingIssuance } from "./founding";
import {
  createMemoryPricingOfferStore,
  resetPricingOfferStoreForTests,
} from "./offer-store";
import { resolveLaunchCheckoutPricing } from "./resolve-checkout";

const ENV_KEYS = [
  "PRICING_LAUNCH_V1",
  "STRIPE_PRICE_GATHER_199",
  "STRIPE_PRICE_GROWING",
  "STRIPE_PRICE_PROFESSIONAL",
  "STRIPE_FOUNDING_PERCENT_COUPON_ID",
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
}

function enableLaunchEnv() {
  process.env.PRICING_LAUNCH_V1 = "true";
  process.env.STRIPE_PRICE_GATHER_199 = "price_gather_199_test";
  process.env.STRIPE_PRICE_GROWING = "price_celebrate_249_test";
  process.env.STRIPE_PRICE_PROFESSIONAL = "price_flourish_349_test";
  process.env.STRIPE_FOUNDING_PERCENT_COUPON_ID = "coupon_founding_10_test";
}

afterEach(() => {
  restoreEnv();
  resetPricingOfferStoreForTests();
});

describe("Checkout offer lifecycle — soft 100", () => {
  it("issues founding, pays after milestone, still earns grant", async () => {
    stashEnv();
    enableLaunchEnv();
    const store = createMemoryPricingOfferStore();

    // Seed 99 earned founding venues.
    for (let i = 0; i < 99; i++) {
      const offer = await store.issueCheckoutOffer({
        planKey: "starter",
        listAmountCents: 19900,
        stripePriceId: "price_gather_199_test",
        foundingIssued: true,
        foundingPercentOff: 10,
        stripeCouponId: "coupon_founding_10_test",
        pricingVersion: "v1",
        checkoutSessionId: `cs_seed_${i}`,
      });
      await store.earnFoundingGrant({
        offerId: offer.id,
        checkoutSessionId: `cs_seed_${i}`,
        venueId: `venue_seed_${i}`,
        percentOff: 10,
      });
    }
    assert.equal(await store.countEarnedFoundingVenues(), 99);

    // Two simultaneous eligible buyers both see 99 → both get founding offers.
    const pricingA = resolveLaunchCheckoutPricing({
      plan: "starter",
      earnedFoundingVenueCount: await store.countEarnedFoundingVenues(),
    });
    const pricingB = resolveLaunchCheckoutPricing({
      plan: "starter",
      earnedFoundingVenueCount: await store.countEarnedFoundingVenues(),
    });
    assert.equal(pricingA.foundingIssued, true);
    assert.equal(pricingB.foundingIssued, true);
    assert.equal(pricingA.foundingCouponId, "coupon_founding_10_test");

    const offerA = await store.issueCheckoutOffer({
      planKey: "starter",
      listAmountCents: pricingA.listAmountCents,
      stripePriceId: pricingA.priceId,
      foundingIssued: pricingA.foundingIssued,
      foundingPercentOff: pricingA.foundingPercentOff,
      stripeCouponId: pricingA.foundingCouponId,
      pricingVersion: pricingA.pricingVersion,
      checkoutSessionId: "cs_overlap_a",
      earnedFoundingCountAtIssue: pricingA.earnedFoundingCountAtIssue,
    });
    const offerB = await store.issueCheckoutOffer({
      planKey: "starter",
      listAmountCents: pricingB.listAmountCents,
      stripePriceId: pricingB.priceId,
      foundingIssued: pricingB.foundingIssued,
      foundingPercentOff: pricingB.foundingPercentOff,
      stripeCouponId: pricingB.foundingCouponId,
      pricingVersion: pricingB.pricingVersion,
      checkoutSessionId: "cs_overlap_b",
      earnedFoundingCountAtIssue: pricingB.earnedFoundingCountAtIssue,
    });

    // A completes first → earned becomes 100.
    await store.earnFoundingGrant({
      offerId: offerA.id,
      checkoutSessionId: "cs_overlap_a",
      venueId: "venue_a",
      percentOff: 10,
    });
    assert.equal(await store.countEarnedFoundingVenues(), 100);

    // New buyer after milestone → standard only.
    assert.equal(
      decideFoundingIssuance({
        earnedFoundingVenueCount: await store.countEarnedFoundingVenues(),
      }).issueFounding,
      false,
    );

    // B's already-issued discounted session still completes as founding (101st).
    const honorB = await store.getOfferBySessionId("cs_overlap_b");
    assert.equal(honorB?.foundingIssued, true);
    const earnB = await store.earnFoundingGrant({
      offerId: offerB.id,
      checkoutSessionId: "cs_overlap_b",
      venueId: "venue_b",
      percentOff: 10,
    });
    assert.equal(earnB.created, true);
    assert.equal(await store.countEarnedFoundingVenues(), 101);
  });

  it("does not count abandoned / unpaid sessions as earned", async () => {
    const store = createMemoryPricingOfferStore();
    await store.issueCheckoutOffer({
      planKey: "starter",
      listAmountCents: 19900,
      stripePriceId: "price_x",
      foundingIssued: true,
      foundingPercentOff: 10,
      stripeCouponId: "coupon_x",
      pricingVersion: "v1",
      checkoutSessionId: "cs_abandoned",
    });
    assert.equal(await store.countEarnedFoundingVenues(), 0);
    await store.markOfferStatus(
      (await store.getOfferBySessionId("cs_abandoned"))!.id,
      "expired",
    );
    assert.equal(await store.countEarnedFoundingVenues(), 0);
  });

  it("webhook/activation retries are idempotent for the same session", async () => {
    const store = createMemoryPricingOfferStore();
    const offer = await store.issueCheckoutOffer({
      planKey: "growing",
      listAmountCents: 24900,
      stripePriceId: "price_c",
      foundingIssued: true,
      foundingPercentOff: 10,
      stripeCouponId: "coupon_10",
      pricingVersion: "v1",
      checkoutSessionId: "cs_retry",
    });
    const first = await store.earnFoundingGrant({
      offerId: offer.id,
      checkoutSessionId: "cs_retry",
      venueId: "venue_retry",
      percentOff: 10,
    });
    const second = await store.earnFoundingGrant({
      offerId: offer.id,
      checkoutSessionId: "cs_retry",
      venueId: "venue_retry",
      percentOff: 10,
    });
    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(first.grant.id, second.grant.id);
    assert.equal(await store.countEarnedFoundingVenues(), 1);

    const bound = await store.bindGrantVenue("cs_retry", "venue_retry");
    assert.equal(bound?.venueId, "venue_retry");
  });

  it("same venue cannot earn founding twice; second venue under one login can", async () => {
    const store = createMemoryPricingOfferStore();
    const first = await store.issueCheckoutOffer({
      planKey: "starter",
      listAmountCents: 19900,
      stripePriceId: "price_a",
      foundingIssued: true,
      foundingPercentOff: 10,
      stripeCouponId: "c",
      pricingVersion: "v1",
      checkoutSessionId: "cs_v1",
    });
    await store.earnFoundingGrant({
      offerId: first.id,
      checkoutSessionId: "cs_v1",
      venueId: "venue_one",
      percentOff: 10,
    });
    assert.equal(await store.venueHasEarnedFounding("venue_one"), true);

    // Duplicate same-venue attempt: grant path returns existing.
    const dupOffer = await store.issueCheckoutOffer({
      planKey: "starter",
      listAmountCents: 19900,
      stripePriceId: "price_a",
      foundingIssued: false,
      foundingPercentOff: null,
      stripeCouponId: null,
      pricingVersion: "v1",
      checkoutSessionId: "cs_v1_dup",
    });
    const dup = await store.earnFoundingGrant({
      offerId: dupOffer.id,
      checkoutSessionId: "cs_v1_dup",
      venueId: "venue_one",
      percentOff: 10,
    });
    assert.equal(dup.created, false);
    assert.equal(await store.countEarnedFoundingVenues(), 1);

    // Second distinct venue may earn while offer available.
    const second = await store.issueCheckoutOffer({
      planKey: "starter",
      listAmountCents: 19900,
      stripePriceId: "price_a",
      foundingIssued: true,
      foundingPercentOff: 10,
      stripeCouponId: "c",
      pricingVersion: "v1",
      checkoutSessionId: "cs_v2",
    });
    const earn2 = await store.earnFoundingGrant({
      offerId: second.id,
      checkoutSessionId: "cs_v2",
      venueId: "venue_two",
      percentOff: 10,
    });
    assert.equal(earn2.created, true);
    assert.equal(await store.countEarnedFoundingVenues(), 2);
  });
});
