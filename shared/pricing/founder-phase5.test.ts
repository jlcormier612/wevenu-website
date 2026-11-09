import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";

import {
  amountForFounderArrangement,
  previewFounderArrangement,
  requiresLargeDiscountConfirmation,
  selectWinningCommercialPrice,
} from "./founder-arrange";
import { decideFounderBillingAdjustment } from "./founder-billing-reconcile";
import {
  createMemoryFounderArrangementStore,
  setFounderArrangementStoreForTests,
  resetFounderArrangementStoreForTests,
} from "./founder-store";
import {
  createFounderArrangement,
  endFounderArrangement,
  processFounderArrangementLifecycle,
} from "./founder-service";
import type { FounderArrangementDraft, FounderArrangementRecord } from "./founder-types";
import { decideGroupBillingAdjustment } from "./group-billing-reconcile";
import { createMemoryTierUpgradeStore } from "./tier-upgrade-store";
import type { EligibleGrant } from "./best-offer";

const ENV_KEYS = [
  "PRICING_FOUNDER_V1",
  "STRIPE_SAAS_PRODUCT_ID",
  "STRIPE_PRICE_GATHER_199",
  "STRIPE_PRICE_GROWING",
  "STRIPE_PRICE_PROFESSIONAL",
  "STRIPE_FOUNDING_PERCENT_COUPON_ID",
  "STRIPE_WEVEN_PERCENT_COUPON_ID",
  "STRIPE_GROUP_PERCENT_COUPON_ID",
] as const;

const savedEnv: Record<string, string | undefined> = {};

function baseArrangement(
  overrides: Partial<FounderArrangementRecord> &
    Pick<FounderArrangementRecord, "id" | "kind">,
): FounderArrangementRecord {
  const now = new Date().toISOString();
  return {
    venueId: "venue-1",
    stripeSubscriptionId: "sub_1",
    stripeCustomerId: "cus_1",
    percentOff: null,
    amountOffCents: null,
    fixedRateCents: null,
    frozenListAmountCents: null,
    planScope: "all",
    planKeyAtCreate: "starter",
    survivesTierChange: true,
    preventsTierUpgrade: overrides.kind === "tier_freeze",
    protectsBaseRate: overrides.kind === "rate_freeze",
    effectiveAt: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: null,
    durationBillingCycles: null,
    cyclesConsumed: 0,
    status: "active",
    reason: "test",
    internalNotes: "secret",
    customerFacingLabel: "Special pricing",
    createdByUserId: null,
    createdByEmail: "jennifer@hellotocheers.com",
    endedByEmail: null,
    endedAt: null,
    endReason: null,
    stripeCouponId: null,
    stripePriceId: null,
    reconciliationStatus: "pending",
    expectedRecurringAmountCents: null,
    lastReconcileError: null,
    lastReconciledAt: null,
    supersedesArrangementId: null,
    supersededByArrangementId: null,
    relatedTierHoldId: null,
    idempotencyKey: overrides.id,
    audit: [],
    metadata: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("Phase 5 founder offer calculations", () => {
  it("Weven 20% beats founder 15%", () => {
    const selection = selectWinningCommercialPrice({
      planKey: "starter",
      grants: [
        {
          id: "w",
          offerType: "weven_pct",
          percentOff: 20,
          status: "earned",
        },
      ],
      groupEligible: false,
      arrangements: [
        baseArrangement({
          id: "a1",
          kind: "percent_off",
          percentOff: 15,
        }),
      ],
    });
    assert.equal(selection.winner.source, "weven_pct");
    assert.equal(selection.winner.expectedAmountCents, 15920);
  });

  it("founder 25% beats Founding 10%", () => {
    const selection = selectWinningCommercialPrice({
      planKey: "starter",
      grants: [
        {
          id: "f",
          offerType: "founding_pct",
          percentOff: 10,
          status: "earned",
        },
      ],
      groupEligible: false,
      arrangements: [
        baseArrangement({
          id: "a1",
          kind: "percent_off",
          percentOff: 25,
        }),
      ],
    });
    assert.equal(selection.winner.source, "founder_override");
    assert.equal(selection.winner.expectedAmountCents, 14925);
  });

  it("founder $50 off beats Group 10% on Gather", () => {
    // Gather 199 - 50 = 149; Group 10% = 179.10
    const selection = selectWinningCommercialPrice({
      planKey: "starter",
      grants: [],
      groupEligible: true,
      arrangements: [
        baseArrangement({
          id: "a1",
          kind: "amount_off",
          amountOffCents: 5000,
        }),
      ],
    });
    assert.equal(selection.winner.source, "founder_override");
    assert.equal(selection.winner.expectedAmountCents, 14900);
  });

  it("Weven 20% beats founder $25 off Gather", () => {
    // Weven 159.20 vs 199-25=174
    const selection = selectWinningCommercialPrice({
      planKey: "starter",
      grants: [
        {
          id: "w",
          offerType: "weven_pct",
          percentOff: 20,
          status: "earned",
        },
      ],
      groupEligible: false,
      arrangements: [
        baseArrangement({
          id: "a1",
          kind: "amount_off",
          amountOffCents: 2500,
        }),
      ],
    });
    assert.equal(selection.winner.source, "weven_pct");
  });

  it("founder fixed $149 beats Group 10%", () => {
    const selection = selectWinningCommercialPrice({
      planKey: "starter",
      grants: [],
      groupEligible: true,
      arrangements: [
        baseArrangement({
          id: "a1",
          kind: "fixed_rate",
          fixedRateCents: 14900,
        }),
      ],
    });
    assert.equal(selection.winner.source, "founder_override");
    assert.equal(selection.winner.expectedAmountCents, 14900);
  });

  it("Founding 10% beats founder fixed $189 Gather", () => {
    // Founding 179.10 vs fixed 189
    const selection = selectWinningCommercialPrice({
      planKey: "starter",
      grants: [
        {
          id: "f",
          offerType: "founding_pct",
          percentOff: 10,
          status: "earned",
        },
      ],
      groupEligible: false,
      arrangements: [
        baseArrangement({
          id: "a1",
          kind: "fixed_rate",
          fixedRateCents: 18900,
        }),
      ],
    });
    assert.equal(selection.winner.source, "founding_pct");
    assert.equal(selection.winner.expectedAmountCents, 17910);
  });

  it("equal-value tie prefers earned Weven over founder", () => {
    // Founder 20% equals Weven 20% → Weven wins tie-break
    const selection = selectWinningCommercialPrice({
      planKey: "starter",
      grants: [
        {
          id: "w",
          offerType: "weven_pct",
          percentOff: 20,
          status: "earned",
        },
      ],
      groupEligible: false,
      arrangements: [
        baseArrangement({
          id: "a1",
          kind: "percent_off",
          percentOff: 20,
        }),
      ],
    });
    assert.equal(selection.winner.source, "weven_pct");
  });

  it("amount_off never goes negative", () => {
    assert.equal(
      amountForFounderArrangement(
        { kind: "amount_off", amountOffCents: 50000, percentOff: null, fixedRateCents: null, frozenListAmountCents: null },
        19900,
      ),
      0,
    );
  });

  it("tier-specific arrangement does not apply to other tiers", () => {
    const selection = selectWinningCommercialPrice({
      planKey: "growing",
      grants: [],
      groupEligible: false,
      arrangements: [
        baseArrangement({
          id: "a1",
          kind: "percent_off",
          percentOff: 30,
          planScope: "starter",
          survivesTierChange: false,
          planKeyAtCreate: "starter",
        }),
      ],
    });
    assert.equal(selection.winner.source, "standard");
    assert.equal(selection.winner.expectedAmountCents, 24900);
  });

  it("multi-tier (all) arrangement follows Celebrate upgrade", () => {
    const selection = selectWinningCommercialPrice({
      planKey: "growing",
      grants: [],
      groupEligible: false,
      arrangements: [
        baseArrangement({
          id: "a1",
          kind: "percent_off",
          percentOff: 25,
          planScope: "all",
          survivesTierChange: true,
        }),
      ],
    });
    assert.equal(selection.winner.expectedAmountCents, 18675);
  });

  it("requires confirmation for large discounts", () => {
    assert.equal(
      requiresLargeDiscountConfirmation({
        kind: "percent_off",
        percentOff: 50,
        listAmountCents: 19900,
      }),
      true,
    );
    assert.equal(
      requiresLargeDiscountConfirmation({
        kind: "fixed_rate",
        fixedRateCents: 0,
        listAmountCents: 19900,
      }),
      true,
    );
  });

  it("preview flags ineffective discount when Weven is better", () => {
    const preview = previewFounderArrangement({
      planKey: "starter",
      grants: [
        {
          id: "w",
          offerType: "weven_pct",
          percentOff: 20,
          status: "earned",
        },
      ],
      groupEligible: false,
      arrangements: [],
      draft: {
        venueId: "v",
        stripeSubscriptionId: "sub",
        kind: "percent_off",
        percentOff: 10,
        effectiveAt: new Date().toISOString(),
        reason: "test",
        idempotencyKey: "k1",
      },
    });
    assert.equal(preview.ineffectiveBecauseBetterOffer, true);
    assert.equal(preview.proposedWinnerSource, "weven_pct");
  });
});

describe("Phase 5 lifecycle + Phase 3/4 compatibility", () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
    }
    process.env.PRICING_FOUNDER_V1 = "true";
    process.env.STRIPE_SAAS_PRODUCT_ID = "prod_test";
    process.env.STRIPE_PRICE_GATHER_199 = "price_gather";
    process.env.STRIPE_PRICE_GROWING = "price_celebrate";
    process.env.STRIPE_PRICE_PROFESSIONAL = "price_flourish";
    process.env.STRIPE_FOUNDING_PERCENT_COUPON_ID = "coupon_founding_10";
    process.env.STRIPE_WEVEN_PERCENT_COUPON_ID = "coupon_weven_20";
    process.env.STRIPE_GROUP_PERCENT_COUPON_ID = "coupon_group_10";
    setFounderArrangementStoreForTests(createMemoryFounderArrangementStore());
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
    resetFounderArrangementStoreForTests();
  });

  it("create → end restores remaining best offer (group)", async () => {
    const store = createMemoryFounderArrangementStore();
    setFounderArrangementStoreForTests(store);
    const tierStore = createMemoryTierUpgradeStore();
    const grants: EligibleGrant[] = [];

    const stripeState = {
      coupon: null as string | null,
      price: "price_gather",
      updates: 0,
    };
    const stripe = {
      coupons: {
        async retrieve(id: string) {
          return { id };
        },
        async create(params: Record<string, unknown>) {
          return { id: String(params.id) };
        },
      },
      prices: {
        async list() {
          return { data: [] };
        },
        async create() {
          return { id: "price_fixed", unit_amount: 14900 };
        },
      },
      subscriptions: {
        async retrieve() {
          return {
            id: "sub_1",
            schedule: null,
            discount: stripeState.coupon
              ? { coupon: stripeState.coupon }
              : null,
            discounts: stripeState.coupon
              ? [{ coupon: stripeState.coupon }]
              : [],
            items: {
              data: [{ id: "si_1", price: { id: stripeState.price } }],
            },
          };
        },
        async update(_id: string, params: Record<string, unknown>) {
          stripeState.updates += 1;
          if (params.discounts === "") stripeState.coupon = null;
          else if (Array.isArray(params.discounts)) {
            const first = params.discounts[0] as { coupon?: string };
            stripeState.coupon = first?.coupon ?? null;
          }
          if (Array.isArray(params.items)) {
            const item = params.items[0] as { price?: string };
            if (item?.price) stripeState.price = item.price;
          }
          return this.retrieve();
        },
      },
    };

    const draft: FounderArrangementDraft = {
      venueId: "venue-1",
      stripeSubscriptionId: "sub_1",
      kind: "percent_off",
      percentOff: 25,
      effectiveAt: new Date(Date.now() - 1000).toISOString(),
      reason: "Strategic customer",
      idempotencyKey: "create-1",
      createdByEmail: "jennifer@hellotocheers.com",
    };

    const created = await createFounderArrangement(
      {
        store,
        stripe,
        tierUpgradeStore: tierStore,
        saasProductId: "prod_test",
        catalogPriceIdForPlan: () => "price_gather",
      },
      {
        draft,
        planKey: "starter",
        grants,
        groupEligible: true,
        confirmLargeDiscount: false,
      },
    );
    assert.equal(created.arrangement.status, "active");
    assert.equal(created.stripeApplied, true);
    assert.ok(stripeState.coupon?.startsWith("htc_fnd_pct_"));

    await endFounderArrangement({
      ctx: {
        store,
        stripe,
        tierUpgradeStore: tierStore,
        saasProductId: "prod_test",
        catalogPriceIdForPlan: () => "price_gather",
      },
      arrangementId: created.arrangement.id,
      endedByEmail: "jennifer@hellotocheers.com",
      endReason: "test end",
      planKey: "starter",
      grants,
      groupEligible: true,
      currentStripeCouponId: stripeState.coupon,
      currentStripePriceId: stripeState.price,
    });

    // After end, group 10% should win → apply_earned_coupon
    assert.equal(stripeState.coupon, "coupon_group_10");
  });

  it("scheduled activate + expire via lifecycle processor", async () => {
    const store = createMemoryFounderArrangementStore();
    setFounderArrangementStoreForTests(store);
    const nowMs = Date.now();
    const future = new Date(nowMs + 60_000).toISOString();
    const effectivePast = new Date(nowMs - 120_000).toISOString();
    const expiresPast = new Date(nowMs - 60_000).toISOString();
    const nowIso = new Date(nowMs).toISOString();

    await store.createArrangement({
      venueId: "venue-1",
      stripeSubscriptionId: "sub_1",
      kind: "percent_off",
      percentOff: 15,
      effectiveAt: future,
      reason: "scheduled",
      idempotencyKey: "sched-1",
      status: "scheduled",
    });

    const expiring = await store.createArrangement({
      venueId: "venue-2",
      stripeSubscriptionId: "sub_2",
      kind: "percent_off",
      percentOff: 15,
      effectiveAt: effectivePast,
      expiresAt: expiresPast,
      reason: "expiring",
      idempotencyKey: "exp-1",
      status: "active",
    });

    const due = await store.listDueToExpire(nowIso);
    assert.equal(due.some((r) => r.id === expiring.id), true);

    const result = await processFounderArrangementLifecycle(
      {
        store,
        stripe: null,
        catalogPriceIdForPlan: () => "price_gather",
      },
      {
        nowIso,
        loadVenueContext: async () => null,
      },
    );
    assert.ok(result.expired >= 1);
    const after = await store.getArrangement(expiring.id);
    assert.equal(after?.status, "expired");
  });

  it("tier freeze places hold and founder reconcile is noop financially", async () => {
    const store = createMemoryFounderArrangementStore();
    setFounderArrangementStoreForTests(store);
    const tierStore = createMemoryTierUpgradeStore();

    const created = await createFounderArrangement(
      {
        store,
        stripe: null,
        tierUpgradeStore: tierStore,
        saasProductId: "prod_test",
        catalogPriceIdForPlan: () => "price_gather",
      },
      {
        draft: {
          venueId: "venue-1",
          stripeSubscriptionId: "sub_1",
          kind: "tier_freeze",
          preventsTierUpgrade: true,
          effectiveAt: new Date(Date.now() - 1000).toISOString(),
          reason: "Strategic hold",
          idempotencyKey: "tf-1",
          createdByEmail: "jennifer@hellotocheers.com",
        },
        planKey: "starter",
        grants: [],
        groupEligible: false,
        dryRun: false,
      },
    );
    assert.equal(created.arrangement.kind, "tier_freeze");
    assert.ok(created.arrangement.relatedTierHoldId);
    const hold = await tierStore.getActiveHoldForVenue("venue-1");
    assert.ok(hold);

    const decision = decideFounderBillingAdjustment({
      venueId: "venue-1",
      planKey: "starter",
      stripeSubscriptionId: "sub_1",
      grants: [],
      groupEligible: false,
      arrangements: [created.arrangement],
      pendingTierUpgrade: null,
    });
    assert.ok(
      decision.action === "noop" || decision.action === "tier_freeze_only",
    );
  });

  it("group reconcile noops when founder arrangement wins", () => {
    const arrangements = [
      baseArrangement({
        id: "a1",
        kind: "fixed_rate",
        fixedRateCents: 14900,
      }),
    ];
    const decision = decideGroupBillingAdjustment({
      venueId: "venue-1",
      organizationId: "org-1",
      planKey: "starter",
      stripeSubscriptionId: "sub_1",
      grants: [],
      groupEligible: true,
      pendingTierUpgrade: null,
      founderArrangements: arrangements,
    });
    assert.equal(decision.action, "noop");
    assert.equal(decision.desiredOfferType, "founder_override");
  });

  it("idempotent create returns same arrangement", async () => {
    const store = createMemoryFounderArrangementStore();
    setFounderArrangementStoreForTests(store);
    const draft: FounderArrangementDraft = {
      venueId: "venue-1",
      stripeSubscriptionId: "sub_1",
      kind: "percent_off",
      percentOff: 15,
      effectiveAt: new Date(Date.now() + 86_400_000).toISOString(),
      reason: "future",
      idempotencyKey: "idem-1",
    };
    const a = await createFounderArrangement(
      { store, stripe: null, catalogPriceIdForPlan: () => null },
      {
        draft,
        planKey: "starter",
        grants: [],
        groupEligible: false,
        dryRun: true,
      },
    );
    const b = await createFounderArrangement(
      { store, stripe: null, catalogPriceIdForPlan: () => null },
      {
        draft,
        planKey: "starter",
        grants: [],
        groupEligible: false,
        dryRun: true,
      },
    );
    assert.equal(a.arrangement.id, b.arrangement.id);
  });
});
