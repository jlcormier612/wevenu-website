import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createPostgresPricingOfferStore } from "./offer-store-postgres";
import {
  abandonIssuedOfferOnStripeFailure,
  createMemoryPricingOfferStore,
  requireDurablePricingOfferStore,
  setPricingOfferStoreForTests,
  resetPricingOfferStoreForTests,
} from "./offer-store";

type Row = Record<string, unknown>;

/**
 * Minimal in-process Supabase mock that exercises the Postgres store paths
 * without applying migrations or talking to a real database.
 */
function createFakeSupabase(seed?: {
  offers?: Row[];
  grants?: Row[];
  wevenClaims?: Row[];
}) {
  const offers: Row[] = [...(seed?.offers ?? [])];
  const grants: Row[] = [...(seed?.grants ?? [])];
  const applications: Row[] = [];
  const wevenClaims: Row[] = [...(seed?.wevenClaims ?? [])];

  function table(name: string) {
    const bucket =
      name === "saas_checkout_offers"
        ? offers
        : name === "saas_offer_grants"
          ? grants
          : name === "weven_claims"
            ? wevenClaims
            : applications;

    const state: {
      filters: Array<[string, unknown]>;
      nullFilters: string[];
      patch: Row | null;
      insertRow: Row | null;
      wantSingle: boolean;
      wantMaybe: boolean;
    } = {
      filters: [],
      nullFilters: [],
      patch: null,
      insertRow: null,
      wantSingle: false,
      wantMaybe: false,
    };

    const api: Record<string, unknown> = {};

    api.select = (_cols: string) => api;
    api.insert = (row: Row) => {
      state.insertRow = { id: crypto.randomUUID(), ...row };
      return api;
    };
    api.update = (patch: Row) => {
      state.patch = patch;
      return api;
    };
    api.eq = (col: string, value: unknown) => {
      state.filters.push([col, value]);
      return api;
    };
    api.is = (col: string, value: unknown) => {
      if (value === null) state.nullFilters.push(col);
      else state.filters.push([col, value]);
      return api;
    };
    api.single = async () => {
      state.wantSingle = true;
      return run();
    };
    api.maybeSingle = async () => {
      state.wantMaybe = true;
      return run();
    };
    // Bare await on select/eq chains that expect arrays.
    api.then = undefined;

    async function run() {
      if (state.insertRow) {
        bucket.push(state.insertRow);
        return { data: state.insertRow, error: null };
      }

      let rows = bucket.filter(
        (row) =>
          state.filters.every(([col, value]) => row[col] === value) &&
          state.nullFilters.every((col) => row[col] == null),
      );

      if (state.patch) {
        if (rows.length === 0) {
          return { data: null, error: { message: "not found" } };
        }
        for (const row of rows) {
          Object.assign(row, state.patch);
        }
        rows = [...rows];
      }

      if (state.wantSingle) {
        if (rows.length === 0) {
          return { data: null, error: { message: "not found" } };
        }
        return { data: rows[0], error: null };
      }
      if (state.wantMaybe) {
        return { data: rows[0] ?? null, error: null };
      }
      return { data: rows, error: null };
    }

    // When caller awaits a select without single/maybeSingle (count path).
    const thenable = {
      ...api,
      then(
        resolve: (value: { data: Row[] | null; error: null }) => void,
      ) {
        void run().then((result) => {
          if (Array.isArray(result.data) || result.data == null) {
            resolve({ data: (result.data as Row[] | null) ?? [], error: null });
          } else {
            resolve({ data: [result.data as Row], error: null });
          }
        });
      },
    };

    // Rebuild chain that returns thenable after select/eq for list queries.
    const listApi: Record<string, unknown> = {};
    listApi.select = (_cols: string) => listApi;
    listApi.eq = (col: string, value: unknown) => {
      state.filters.push([col, value]);
      return listApi;
    };
    listApi.is = (col: string, value: unknown) => {
      if (value === null) state.nullFilters.push(col);
      else state.filters.push([col, value]);
      return listApi;
    };
    listApi.insert = api.insert;
    listApi.update = (patch: Row) => {
      state.patch = patch;
      return listApi;
    };
    listApi.single = api.single;
    listApi.maybeSingle = api.maybeSingle;
    (listApi as { then: typeof thenable.then }).then = thenable.then;

    return listApi;
  }

  return {
    from(name: string) {
      return table(name);
    },
    _offers: offers,
    _grants: grants,
    _wevenClaims: wevenClaims,
  };
}

describe("Postgres PricingOfferStore (fake client)", () => {
  it("persists offer issuance, session attach, paid earn, and venue bind", async () => {
    const fake = createFakeSupabase();
    const store = createPostgresPricingOfferStore(fake as never);
    assert.equal(store.durable, true);

    const offer = await store.issueCheckoutOffer({
      planKey: "starter",
      listAmountCents: 19900,
      stripePriceId: "price_199",
      foundingIssued: true,
      foundingPercentOff: 10,
      stripeCouponId: "coupon_10",
      pricingVersion: "v1",
      relationshipId: "rel_1",
    });
    assert.equal(offer.offerStatus, "issued");
    assert.equal(offer.checkoutSessionId, null);

    const attached = await store.attachCheckoutSession(offer.id, "cs_test_1");
    assert.equal(attached.checkoutSessionId, "cs_test_1");

    const bySession = await store.getOfferBySessionId("cs_test_1");
    assert.equal(bySession?.id, offer.id);

    await store.markOfferStatus(offer.id, "paid", {
      paidAt: new Date().toISOString(),
    });

    const earn1 = await store.earnFoundingGrant({
      offerId: offer.id,
      checkoutSessionId: "cs_test_1",
      percentOff: 10,
      relationshipId: "rel_1",
    });
    assert.equal(earn1.created, true);
    assert.equal(await store.countEarnedFoundingVenues(), 1);

    const earn2 = await store.earnFoundingGrant({
      offerId: offer.id,
      checkoutSessionId: "cs_test_1",
      percentOff: 10,
    });
    assert.equal(earn2.created, false);
    assert.equal(earn2.grant.id, earn1.grant.id);

    const bound = await store.bindGrantVenue("cs_test_1", "venue_abc");
    assert.equal(bound?.venueId, "venue_abc");
    assert.equal(await store.venueHasEarnedFounding("venue_abc"), true);
    assert.equal(await store.countEarnedFoundingVenues(), 1);
  });

  it("does not count unpaid issued offers toward the milestone", async () => {
    const fake = createFakeSupabase();
    const store = createPostgresPricingOfferStore(fake as never);
    await store.issueCheckoutOffer({
      planKey: "starter",
      listAmountCents: 19900,
      stripePriceId: "price_199",
      foundingIssued: true,
      foundingPercentOff: 10,
      stripeCouponId: "coupon_10",
      pricingVersion: "v1",
      checkoutSessionId: "cs_abandoned",
    });
    assert.equal(await store.countEarnedFoundingVenues(), 0);
  });

  it("keeps two venues under one login independent for founding grants", async () => {
    const fake = createFakeSupabase();
    const store = createPostgresPricingOfferStore(fake as never);

    const a = await store.issueCheckoutOffer({
      planKey: "starter",
      listAmountCents: 19900,
      stripePriceId: "price_199",
      foundingIssued: true,
      foundingPercentOff: 10,
      stripeCouponId: "c",
      pricingVersion: "v1",
      checkoutSessionId: "cs_a",
    });
    const b = await store.issueCheckoutOffer({
      planKey: "growing",
      listAmountCents: 24900,
      stripePriceId: "price_249",
      foundingIssued: true,
      foundingPercentOff: 10,
      stripeCouponId: "c",
      pricingVersion: "v1",
      checkoutSessionId: "cs_b",
    });
    await store.earnFoundingGrant({
      offerId: a.id,
      checkoutSessionId: "cs_a",
      venueId: "venue_a",
      percentOff: 10,
    });
    await store.earnFoundingGrant({
      offerId: b.id,
      checkoutSessionId: "cs_b",
      venueId: "venue_b",
      percentOff: 10,
    });
    assert.equal(await store.countEarnedFoundingVenues(), 2);
    assert.equal(await store.venueHasEarnedFounding("venue_a"), true);
    assert.equal(await store.venueHasEarnedFounding("venue_b"), true);
  });
});

describe("Stripe Session create failure abandons issued offer", () => {
  it("marks the offer failed so it cannot later count as earned", async () => {
    const store = createMemoryPricingOfferStore();
    const offer = await store.issueCheckoutOffer({
      planKey: "starter",
      listAmountCents: 19900,
      stripePriceId: "price_199",
      foundingIssued: true,
      foundingPercentOff: 10,
      stripeCouponId: "c",
      pricingVersion: "v1",
    });
    await abandonIssuedOfferOnStripeFailure(store, offer.id, "stripe_boom");
    const updated = await store.getOfferById(offer.id);
    assert.equal(updated?.offerStatus, "failed");
    assert.equal(await store.countEarnedFoundingVenues(), 0);
  });
});

describe("requireDurablePricingOfferStore", () => {
  it("rejects memory store when Launch flag is enabled", () => {
    const previous = process.env.PRICING_LAUNCH_V1;
    process.env.PRICING_LAUNCH_V1 = "true";
    setPricingOfferStoreForTests(createMemoryPricingOfferStore());
    try {
      assert.throws(() => requireDurablePricingOfferStore(), /durable Postgres/);
    } finally {
      if (previous === undefined) delete process.env.PRICING_LAUNCH_V1;
      else process.env.PRICING_LAUNCH_V1 = previous;
      resetPricingOfferStoreForTests();
    }
  });

  it("accepts an injected durable store", () => {
    const durable = createMemoryPricingOfferStore();
    (durable as { durable: boolean }).durable = true;
    setPricingOfferStoreForTests(durable);
    try {
      assert.equal(requireDurablePricingOfferStore().durable, true);
    } finally {
      resetPricingOfferStoreForTests();
    }
  });
});
