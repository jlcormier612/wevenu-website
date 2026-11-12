/**
 * Phase 6 — Refer a Venue focused tests.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { listAmountCents } from "./catalog";
import type { FounderArrangementRecord } from "./founder-types";
import { getReferralProgramPolicy } from "./referral-policy";
import {
  approveReferralReward,
  confirmReferralAttribution,
  evaluateReferralQualification,
  issueReferralRewardCredit,
  markAttributionPaid,
  processReferralLifecycle,
  submitVenueReferral,
  type ReferralServiceContext,
  type ReferralVenueBillingSnapshot,
} from "./referral-service";
import {
  createMemoryReferralStore,
  resetReferralStoreForTests,
  setReferralStoreForTests,
} from "./referral-store";
import type { StripeReferralExecutor } from "./referral-stripe-execute";
import { valueReferrerReward } from "./referral-value";
import { validateReferralSubmission } from "./referral-validate";

function baseVenue(
  overrides: Partial<ReferralVenueBillingSnapshot> & { venueId: string },
): ReferralVenueBillingSnapshot {
  return {
    name: "Test Venue",
    website: "https://example-venue.com",
    websiteDomain: "example-venue.com",
    organizationId: null,
    planKey: "starter",
    stripeSubscriptionId: "sub_referrer",
    stripeCustomerId: "cus_referrer",
    subscriptionStatus: "active",
    grants: [],
    groupEligible: false,
    arrangements: [],
    ...overrides,
  };
}

function makeCtx(opts?: {
  venues?: Map<string, ReferralVenueBillingSnapshot>;
  stripe?: StripeReferralExecutor | null;
  forceQualificationNow?: boolean;
}): ReferralServiceContext {
  const store = createMemoryReferralStore();
  setReferralStoreForTests(store);
  const venues =
    opts?.venues ??
    new Map<string, ReferralVenueBillingSnapshot>([
      [
        "venue-ref",
        baseVenue({
          venueId: "venue-ref",
          websiteDomain: "willowgrove.test",
          website: "https://willowgrove.test",
        }),
      ],
    ]);

  return {
    store,
    loadVenue: async (id) => venues.get(id) ?? null,
    listOrgVenueIds: async (orgId) =>
      [...venues.values()]
        .filter((v) => v.organizationId === orgId)
        .map((v) => v.venueId),
    stripe: opts?.stripe ?? null,
    forceQualificationNow: opts?.forceQualificationNow,
  };
}

function fakeStripe(): StripeReferralExecutor & {
  items: Map<string, { id: string; invoice: string | null; subscription: string; amount: number }>;
  invoiceRows: Map<
    string,
    { id: string; subscription: string; status: string; itemIds: string[] }
  >;
} {
  const items = new Map<
    string,
    { id: string; invoice: string | null; subscription: string; amount: number }
  >();
  const invoiceRows = new Map<
    string,
    { id: string; subscription: string; status: string; itemIds: string[] }
  >();
  let itemSeq = 0;

  return {
    items,
    invoiceRows,
    invoiceItems: {
      async create(params, _opts) {
        itemSeq += 1;
        const id = `ii_test_${itemSeq}`;
        items.set(id, {
          id,
          invoice: null,
          subscription: params.subscription,
          amount: params.amount,
        });
        return {
          id,
          customer: params.customer,
          subscription: params.subscription,
          amount: params.amount,
          currency: params.currency,
          invoice: null,
          metadata: params.metadata ?? null,
        };
      },
      async retrieve(id) {
        const row = items.get(id);
        if (!row) throw new Error("missing");
        return {
          id: row.id,
          customer: "cus_referrer",
          subscription: row.subscription,
          amount: row.amount,
          currency: "usd",
          invoice: row.invoice,
        };
      },
    },
    invoices: {
      async retrieve(id) {
        const inv = invoiceRows.get(id);
        if (!inv) throw new Error("missing invoice");
        return {
          id: inv.id,
          subscription: inv.subscription,
          status: inv.status,
          lines: {
            data: inv.itemIds.map((itemId) => ({
              id: `il_${itemId}`,
              invoice_item: itemId,
              amount: items.get(itemId)?.amount ?? 0,
            })),
          },
        };
      },
      async list(params) {
        const data = [...invoiceRows.values()]
          .filter((i) => i.subscription === params.subscription)
          .map((inv) => ({
            id: inv.id,
            subscription: inv.subscription,
            status: inv.status,
            lines: {
              data: inv.itemIds.map((itemId) => ({
                id: `il_${itemId}`,
                invoice_item: itemId,
                amount: items.get(itemId)?.amount ?? 0,
              })),
            },
          }));
        return { data };
      },
    },
  };
}

beforeEach(() => {
  process.env.REFERRAL_PROGRAM_V1 = "true";
  process.env.REFERRAL_REWARD_ISSUE = "true";
  process.env.REFERRAL_QUALIFICATION_DAYS = "30";
  resetReferralStoreForTests();
});

afterEach(() => {
  resetReferralStoreForTests();
  delete process.env.REFERRAL_PROGRAM_V1;
  delete process.env.REFERRAL_REWARD_ISSUE;
  delete process.env.REFERRAL_QUALIFICATION_DAYS;
});

describe("referral validation", () => {
  it("requires core fields and rejects form URLs as email", () => {
    const bad = validateReferralSubmission({
      venueName: "",
      city: "",
      state: "",
      website: "not a url",
      contactEmail: "https://example.com/contact",
      contactName: "",
    });
    assert.equal(bad.ok, false);
    if (bad.ok) return;
    assert.ok(bad.errors.venueName);
    assert.ok(bad.errors.contactEmail);

    const good = validateReferralSubmission({
      venueName: "River Barn",
      city: "Austin",
      state: "TX",
      website: "riverbarn.com",
      contactEmail: "hello@riverbarn.com",
      contactName: "Alex",
    });
    assert.equal(good.ok, true);
    if (!good.ok) return;
    assert.equal(good.cleaned.website.startsWith("https://"), true);
  });
});

describe("reward valuation", () => {
  it("values standard, founding, weven, group, and founder fixed", () => {
    const standard = valueReferrerReward({
      planKey: "starter",
      grants: [],
      groupEligible: false,
      arrangements: [],
    });
    assert.equal(standard.amountCents, 19900);

    const founding = valueReferrerReward({
      planKey: "starter",
      grants: [
        {
          id: "g1",
          offerType: "founding_pct",
          percentOff: 10,
          status: "earned",
        },
      ],
      groupEligible: false,
      arrangements: [],
    });
    assert.equal(founding.amountCents, 17910);

    const weven = valueReferrerReward({
      planKey: "starter",
      grants: [
        {
          id: "g2",
          offerType: "weven_pct",
          percentOff: 20,
          status: "earned",
        },
      ],
      groupEligible: false,
      arrangements: [],
    });
    assert.equal(weven.amountCents, 15920);

    const group = valueReferrerReward({
      planKey: "growing",
      grants: [],
      groupEligible: true,
      arrangements: [],
    });
    assert.equal(group.amountCents, 22410);

    const fixed: FounderArrangementRecord = {
      id: "arr1",
      venueId: "v",
      stripeSubscriptionId: "sub",
      stripeCustomerId: "cus",
      kind: "fixed_rate",
      percentOff: null,
      amountOffCents: null,
      fixedRateCents: 14900,
      frozenListAmountCents: null,
      planScope: "all",
      planKeyAtCreate: "starter",
      survivesTierChange: true,
      preventsTierUpgrade: false,
      protectsBaseRate: false,
      effectiveAt: new Date(0).toISOString(),
      expiresAt: null,
      durationBillingCycles: null,
      cyclesConsumed: 0,
      status: "active",
      reason: "test",
      internalNotes: null,
      customerFacingLabel: "Fixed $149",
      createdByUserId: null,
      createdByEmail: null,
      endedByEmail: null,
      endedAt: null,
      endReason: null,
      stripeCouponId: null,
      stripePriceId: "price_fixed",
      reconciliationStatus: "applied",
      expectedRecurringAmountCents: 14900,
      lastReconcileError: null,
      lastReconciledAt: null,
      supersedesArrangementId: null,
      supersededByArrangementId: null,
      relatedTierHoldId: null,
      idempotencyKey: "k",
      audit: [],
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const founderFixed = valueReferrerReward({
      planKey: "starter",
      grants: [],
      groupEligible: false,
      arrangements: [fixed],
    });
    assert.equal(founderFixed.amountCents, 14900);
    assert.equal(founderFixed.snapshot.excludes.includes("white_glove"), true);
    assert.equal(listAmountCents("professional"), 34900);
  });

  it("keeps valuation snapshot immutable after tier change input", () => {
    const before = valueReferrerReward({
      planKey: "starter",
      grants: [],
      groupEligible: false,
      arrangements: [],
      valuedAt: "2026-01-01T00:00:00.000Z",
    });
    const after = valueReferrerReward({
      planKey: "professional",
      grants: [],
      groupEligible: false,
      arrangements: [],
      valuedAt: "2026-02-01T00:00:00.000Z",
    });
    assert.equal(before.amountCents, 19900);
    assert.equal(after.amountCents, 34900);
    assert.notEqual(before.amountCents, after.amountCents);
  });
});

describe("submission safeguards", () => {
  it("accepts a valid referral and never promises a reward", async () => {
    const ctx = makeCtx();
    const result = await submitVenueReferral(ctx, {
      referringVenueId: "venue-ref",
      submittedByEmail: "owner@willowgrove.test",
      form: {
        venueName: "Cedar Hall",
        city: "Dallas",
        state: "TX",
        website: "https://cedarhall.test",
        contactEmail: "hello@cedarhall.test",
        contactName: "Sam",
      },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.match(result.confirmation.title, /Thanks for sharing the Luv/i);
    assert.match(result.confirmation.body, /take it from here/i);
    assert.doesNotMatch(result.confirmation.body, /automatically contact/i);
    assert.equal(result.referral.status, "submitted");
  });

  it("blocks self-referral by domain", async () => {
    const ctx = makeCtx();
    const result = await submitVenueReferral(ctx, {
      referringVenueId: "venue-ref",
      form: {
        venueName: "Self",
        city: "Austin",
        state: "TX",
        website: "https://willowgrove.test",
        contactEmail: "other@example.com",
        contactName: "Self",
      },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.referral.isSelfReferral, true);
    assert.equal(result.referral.status, "closed_not_eligible");
  });

  it("blocks same-organization property referral", async () => {
    const venues = new Map<string, ReferralVenueBillingSnapshot>([
      [
        "v1",
        baseVenue({
          venueId: "v1",
          organizationId: "org1",
          websiteDomain: "alpha.test",
          website: "https://alpha.test",
        }),
      ],
      [
        "v2",
        baseVenue({
          venueId: "v2",
          organizationId: "org1",
          websiteDomain: "beta.test",
          website: "https://beta.test",
        }),
      ],
    ]);
    const ctx = makeCtx({ venues });
    const result = await submitVenueReferral(ctx, {
      referringVenueId: "v1",
      form: {
        venueName: "Beta",
        city: "Austin",
        state: "TX",
        website: "https://beta.test",
        contactEmail: "hello@beta.test",
        contactName: "Pat",
      },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.referral.isSameOrganization, true);
    assert.equal(result.referral.status, "closed_not_eligible");
  });

  it("flags duplicate submissions from the same referrer", async () => {
    const ctx = makeCtx();
    const first = await submitVenueReferral(ctx, {
      referringVenueId: "venue-ref",
      form: {
        venueName: "Cedar Hall",
        city: "Dallas",
        state: "TX",
        website: "https://cedarhall.test",
        contactEmail: "hello@cedarhall.test",
        contactName: "Sam",
      },
    });
    assert.equal(first.ok, true);
    const second = await submitVenueReferral(ctx, {
      referringVenueId: "venue-ref",
      form: {
        venueName: "Cedar Hall",
        city: "Dallas",
        state: "TX",
        website: "https://cedarhall.test",
        contactEmail: "hello@cedarhall.test",
        contactName: "Sam",
      },
    });
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.referral.isDuplicateClaim, true);
    assert.equal(second.referral.status, "closed_duplicate");
  });
});

describe("attribution + qualification + stripe credit", () => {
  it("runs conversion → qualify → approve → issue → apply without duplicates", async () => {
    const stripe = fakeStripe();
    const venues = new Map<string, ReferralVenueBillingSnapshot>([
      [
        "venue-ref",
        baseVenue({
          venueId: "venue-ref",
          websiteDomain: "willowgrove.test",
          grants: [
            {
              id: "founding",
              offerType: "founding_pct",
              percentOff: 10,
              status: "earned",
            },
          ],
        }),
      ],
      [
        "venue-new",
        baseVenue({
          venueId: "venue-new",
          websiteDomain: "cedarhall.test",
          website: "https://cedarhall.test",
          stripeSubscriptionId: "sub_new",
          stripeCustomerId: "cus_new",
          subscriptionStatus: "active",
        }),
      ],
    ]);
    const ctx = makeCtx({ venues, stripe, forceQualificationNow: true });

    const submitted = await submitVenueReferral(ctx, {
      referringVenueId: "venue-ref",
      form: {
        venueName: "Cedar Hall",
        city: "Dallas",
        state: "TX",
        website: "https://cedarhall.test",
        contactEmail: "hello@cedarhall.test",
        contactName: "Sam",
      },
    });
    assert.equal(submitted.ok, true);
    if (!submitted.ok) return;

    const attr = await confirmReferralAttribution(ctx, {
      referralId: submitted.referral.id,
      referredVenueId: "venue-new",
      actorEmail: "founder@htc.test",
      matchMethod: "founder_confirmed",
    });

    const paidAt = "2026-01-01T00:00:00.000Z";
    await markAttributionPaid(ctx, {
      attributionId: attr.id,
      firstPaidInvoiceId: "in_paid_1",
      firstPaidInvoiceAt: paidAt,
      actorEmail: "system",
    });

    // Duplicate paid webhook ignored for first invoice identity
    await markAttributionPaid(ctx, {
      attributionId: attr.id,
      firstPaidInvoiceId: "in_paid_1",
      firstPaidInvoiceAt: paidAt,
      actorEmail: "system",
    });

    const reward = await evaluateReferralQualification(ctx, attr.id, {
      actorEmail: "scheduler",
      forceNow: true,
    });
    assert.ok(reward);
    assert.equal(reward!.status, "eligible");
    assert.equal(reward!.rewardAmountCents, 17910);

    // Tier change after valuation must not alter snapshot
    venues.set(
      "venue-ref",
      baseVenue({
        venueId: "venue-ref",
        planKey: "professional",
        websiteDomain: "willowgrove.test",
        grants: [],
      }),
    );
    const again = await evaluateReferralQualification(ctx, attr.id, {
      forceNow: true,
    });
    assert.equal(again!.rewardAmountCents, 17910);

    await approveReferralReward(ctx, {
      rewardId: reward!.id,
      actorEmail: "founder@htc.test",
    });

    const issued = await issueReferralRewardCredit(ctx, reward!.id, {
      actorEmail: "founder@htc.test",
    });
    assert.equal(issued.status, "issued");
    assert.ok(issued.stripeInvoiceItemId);
    assert.equal(stripe.items.get(issued.stripeInvoiceItemId!)?.amount, -17910);
    assert.equal(
      stripe.items.get(issued.stripeInvoiceItemId!)?.subscription,
      "sub_referrer",
    );

    // Idempotent re-issue
    const issued2 = await issueReferralRewardCredit(ctx, reward!.id);
    assert.equal(issued2.stripeInvoiceItemId, issued.stripeInvoiceItemId);
    assert.equal(stripe.items.size, 1);

    // Simulate invoice application
    const itemId = issued.stripeInvoiceItemId!;
    stripe.items.get(itemId)!.invoice = "in_applied_1";
    stripe.invoiceRows.set("in_applied_1", {
      id: "in_applied_1",
      subscription: "sub_referrer",
      status: "paid",
      itemIds: [itemId],
    });

    const lifecycle = await processReferralLifecycle(ctx, {
      autoIssueApproved: false,
    });
    assert.equal(lifecycle.applied, 1);
    const finalReward = await ctx.store.getReward(reward!.id);
    assert.equal(finalReward?.status, "applied");
    assert.equal(finalReward?.appliedInvoiceId, "in_applied_1");
  });

  it("does not qualify unpaid / canceled referred venues", async () => {
    const venues = new Map<string, ReferralVenueBillingSnapshot>([
      [
        "venue-ref",
        baseVenue({ venueId: "venue-ref", websiteDomain: "willowgrove.test" }),
      ],
      [
        "venue-new",
        baseVenue({
          venueId: "venue-new",
          websiteDomain: "cedarhall.test",
          stripeSubscriptionId: "sub_new",
          stripeCustomerId: "cus_new",
          subscriptionStatus: "canceled",
        }),
      ],
    ]);
    const ctx = makeCtx({ venues, forceQualificationNow: true });
    const submitted = await submitVenueReferral(ctx, {
      referringVenueId: "venue-ref",
      form: {
        venueName: "Cedar Hall",
        city: "Dallas",
        state: "TX",
        website: "https://cedarhall.test",
        contactEmail: "hello@cedarhall.test",
        contactName: "Sam",
      },
    });
    assert.equal(submitted.ok, true);
    if (!submitted.ok) return;
    const attr = await confirmReferralAttribution(ctx, {
      referralId: submitted.referral.id,
      referredVenueId: "venue-new",
      actorEmail: "founder@htc.test",
    });
    await markAttributionPaid(ctx, {
      attributionId: attr.id,
      firstPaidInvoiceId: "in_1",
      firstPaidInvoiceAt: "2026-01-01T00:00:00.000Z",
    });
    const reward = await evaluateReferralQualification(ctx, attr.id, {
      forceNow: true,
    });
    assert.equal(reward, null);
    const referral = await ctx.store.getReferral(submitted.referral.id);
    assert.equal(referral?.status, "closed_not_eligible");
  });
});

describe("policy config", () => {
  it("reads qualification days from env without hardcoding into valuation", () => {
    process.env.REFERRAL_QUALIFICATION_DAYS = "45";
    const policy = getReferralProgramPolicy();
    assert.equal(policy.qualificationDays, 45);
    assert.equal(policy.cashEquivalent, false);
    assert.equal(policy.recipient, "referring_venue");
  });
});
