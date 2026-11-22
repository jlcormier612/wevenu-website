import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  computeSalesOfferPreview,
  validateSalesOfferTerms,
} from "./sales-offer-compute";
import {
  createMemorySalesOfferStore,
  SalesOfferConflictError,
  SalesOfferForbiddenError,
  SalesOfferValidationError,
} from "./sales-offer-store";
import type { SalesOfferTermsInput } from "./sales-offer-types";

function baseTerms(
  overrides: Partial<SalesOfferTermsInput> = {},
): SalesOfferTermsInput {
  return {
    planKey: "starter",
    pricingKind: "standard",
    durationMode: "ongoing",
    afterIntroPricing: "standard_list",
    whiteGloveMode: "none",
    replacesStandardPromos: true,
    ...overrides,
  };
}

describe("sales-offer Stage 1 validation", () => {
  it("computes standard Gather with WG 499", () => {
    const v = validateSalesOfferTerms(
      baseTerms({ whiteGloveMode: "standard_499" }),
    );
    assert.equal(v.ok, true);
    if (!v.ok) return;
    const preview = computeSalesOfferPreview(v.normalized);
    assert.equal(preview.monthlyRecurringCents, 19900);
    assert.equal(preview.whiteGloveAmountCents, 49900);
    assert.equal(preview.initialPaymentCents, 69800);
  });

  it("applies percent off Celebrate", () => {
    const v = validateSalesOfferTerms(
      baseTerms({
        planKey: "growing",
        pricingKind: "percent_off",
        percentOff: 15,
        percentUpgradePolicy: "follow",
      }),
    );
    assert.equal(v.ok, true);
    if (!v.ok) return;
    const preview = computeSalesOfferPreview(v.normalized);
    assert.equal(preview.listAmountCents, 24900);
    assert.equal(preview.monthlyRecurringCents, 21165);
    assert.match(preview.tierUpgradeLabel, /follows/i);
  });

  it("applies fixed-dollar discount", () => {
    const v = validateSalesOfferTerms(
      baseTerms({
        pricingKind: "amount_off",
        amountOffCents: 4000,
      }),
    );
    assert.equal(v.ok, true);
    if (!v.ok) return;
    assert.equal(computeSalesOfferPreview(v.normalized).monthlyRecurringCents, 15900);
  });

  it("rejects negative and stacked invalid amounts", () => {
    const neg = validateSalesOfferTerms(
      baseTerms({ pricingKind: "fixed_rate", fixedRateCents: -1 }),
    );
    assert.equal(neg.ok, false);

    const tooMuch = validateSalesOfferTerms(
      baseTerms({ pricingKind: "amount_off", amountOffCents: 19900 }),
    );
    assert.equal(tooMuch.ok, false);
  });

  it("requires fallback for fixed replace policy", () => {
    const missing = validateSalesOfferTerms(
      baseTerms({
        pricingKind: "fixed_rate",
        fixedRateCents: 17500,
        fixedUpgradePolicy: "replace",
        fixedReplacementPrices: { growing: 20000 },
      }),
    );
    assert.equal(missing.ok, false);

    const ok = validateSalesOfferTerms(
      baseTerms({
        pricingKind: "fixed_rate",
        fixedRateCents: 17500,
        fixedUpgradePolicy: "replace",
        fixedReplacementPrices: { growing: 20000 },
        fixedUpgradeFallback: "standard_list",
      }),
    );
    assert.equal(ok.ok, true);
  });

  it("supports limited duration and after-intro resume", () => {
    const v = validateSalesOfferTerms(
      baseTerms({
        pricingKind: "percent_off",
        percentOff: 20,
        durationMode: "billing_cycles",
        durationBillingCycles: 3,
        afterIntroPricing: "eligible_discount",
      }),
    );
    assert.equal(v.ok, true);
    if (!v.ok) return;
    const preview = computeSalesOfferPreview(v.normalized);
    assert.match(preview.durationLabel, /3 billing/);
    assert.match(preview.afterIntroLabel, /eligible standard discount/i);
    assert.equal(preview.afterIntroMonthlyCents, null);
  });

  it("supports WG weven / custom / waived", () => {
    for (const [mode, expected] of [
      ["weven_399", 39900],
      ["custom", 25000],
      ["waived", 0],
    ] as const) {
      const v = validateSalesOfferTerms(
        baseTerms({
          whiteGloveMode: mode,
          whiteGloveAmountCents: mode === "custom" ? 25000 : undefined,
        }),
      );
      assert.equal(v.ok, true);
      if (!v.ok) return;
      assert.equal(
        computeSalesOfferPreview(v.normalized).whiteGloveAmountCents,
        expected,
      );
    }
  });

  it("preview never includes internal notes field", () => {
    const v = validateSalesOfferTerms(baseTerms({ pricingKind: "standard" }));
    assert.equal(v.ok, true);
    if (!v.ok) return;
    const preview = computeSalesOfferPreview(v.normalized);
    assert.equal("internalNotes" in preview, false);
    assert.ok(preview.lines.every((l) => !/internal/i.test(l) || /does not/.test(l)));
  });
});

describe("sales-offer Stage 1 store", () => {
  let store = createMemorySalesOfferStore();

  beforeEach(() => {
    store = createMemorySalesOfferStore();
  });

  afterEach(() => {
    store = createMemorySalesOfferStore();
  });

  it("creates, updates, duplicates, discards drafts with revisions", async () => {
    const created = await store.createDraft({
      relationshipId: "rel-1",
      internalName: "Spring Gather deal",
      internalNotes: "Founder only",
      terms: baseTerms({
        pricingKind: "fixed_rate",
        fixedRateCents: 17500,
        fixedUpgradePolicy: "keep",
        whiteGloveMode: "waived",
      }),
      createdByEmail: "founder@hellotocheers.com",
    });
    assert.equal(created.status, "draft");
    assert.equal(created.revision, 1);
    assert.equal(created.checkoutSessionId, null);

    const updated = await store.updateDraft({
      offerId: created.id,
      relationshipId: "rel-1",
      expectedRevision: 1,
      terms: baseTerms({
        pricingKind: "fixed_rate",
        fixedRateCents: 16500,
        fixedUpgradePolicy: "keep",
        whiteGloveMode: "standard_499",
      }),
      updatedByEmail: "founder@hellotocheers.com",
      changeSummary: "Lowered rate; added WG",
    });
    assert.equal(updated.revision, 2);
    assert.equal(updated.fixedRateCents, 16500);

    const revisions = await store.listRevisions(created.id);
    assert.equal(revisions.length, 2);

    const copy = await store.duplicateDraft({
      offerId: created.id,
      relationshipId: "rel-1",
      createdByEmail: "admin@hellotocheers.com",
    });
    assert.equal(copy.status, "draft");
    assert.notEqual(copy.id, created.id);
    assert.match(copy.internalName, /copy/i);

    const discarded = await store.discardDraft({
      offerId: created.id,
      relationshipId: "rel-1",
      expectedRevision: 2,
      updatedByEmail: "founder@hellotocheers.com",
    });
    assert.equal(discarded.status, "discarded");
  });

  it("blocks cross-relationship updates and concurrent edits", async () => {
    const created = await store.createDraft({
      relationshipId: "rel-a",
      internalName: "A",
      terms: baseTerms(),
    });

    await assert.rejects(
      () =>
        store.updateDraft({
          offerId: created.id,
          relationshipId: "rel-b",
          expectedRevision: 1,
          internalName: "hack",
        }),
      SalesOfferForbiddenError,
    );

    await assert.rejects(
      () =>
        store.updateDraft({
          offerId: created.id,
          relationshipId: "rel-a",
          expectedRevision: 99,
          internalName: "stale",
        }),
      SalesOfferConflictError,
    );
  });

  it("rejects invalid terms on create", async () => {
    await assert.rejects(
      () =>
        store.createDraft({
          relationshipId: "rel-1",
          internalName: "bad",
          terms: baseTerms({ pricingKind: "percent_off", percentOff: -5 }),
        }),
      SalesOfferValidationError,
    );
  });
});
