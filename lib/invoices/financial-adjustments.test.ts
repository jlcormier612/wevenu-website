import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeAgreedFinancialTermsMulti,
  redistributeUnpaidInstallments,
} from "@/lib/invoices/financial-adjustments";
import { computeAgreedFinancialTerms } from "@/lib/invoices/financial-terms";

describe("computeAgreedFinancialTermsMulti", () => {
  it("applies two fixed reductions: $25,000 − $500 − $2,500 = $22,000", () => {
    const t = computeAgreedFinancialTermsMulti({
      packagePrice: 25000,
      adjustments: [
        {
          kind: "credit",
          description: "Referral credit",
          mode: "fixed",
          value: 500,
        },
        {
          kind: "discount",
          description: "Promotional discount",
          mode: "fixed",
          value: 2500,
        },
      ],
    });
    assert.equal(t.discountAmount, 3000);
    assert.equal(t.chargeAmount, 0);
    assert.equal(t.taxableBase, 22000);
    assert.equal(t.finalTotal, 22000);
    assert.equal(t.adjustments.length, 2);
    assert.equal(t.adjustments[0]?.description, "Referral credit");
    assert.equal(t.adjustments[1]?.amount, 2500);
  });

  it("applies 6.25% exclusive tax on the reduced base", () => {
    const t = computeAgreedFinancialTermsMulti({
      packagePrice: 25000,
      adjustments: [
        { kind: "credit", description: "Referral credit", mode: "fixed", value: 500 },
        { kind: "discount", description: "Promo", mode: "fixed", value: 2500 },
      ],
      applyTax: true,
      taxRatePercent: 6.25,
    });
    assert.equal(t.taxableBase, 22000);
    assert.equal(t.taxAmount, 1375);
    assert.equal(t.finalTotal, 23375);
  });

  it("does not apply tax when applyTax is false even with a rate", () => {
    const t = computeAgreedFinancialTermsMulti({
      packagePrice: 25000,
      adjustments: [
        { kind: "discount", description: "Promo", mode: "fixed", value: 2500 },
      ],
      applyTax: false,
      taxRatePercent: 6.25,
    });
    assert.equal(t.taxAmount, 0);
    assert.equal(t.finalTotal, 22500);
  });

  it("treats charges as additions, not reductions", () => {
    const t = computeAgreedFinancialTermsMulti({
      packagePrice: 10000,
      adjustments: [
        { kind: "discount", description: "Promo", mode: "fixed", value: 1000 },
        { kind: "fee", description: "Security fee", mode: "fixed", value: 200 },
      ],
      applyTax: true,
      taxRatePercent: 10,
    });
    assert.equal(t.discountAmount, 1000);
    assert.equal(t.chargeAmount, 200);
    assert.equal(t.taxableBase, 9200);
    assert.equal(t.taxAmount, 920);
    assert.equal(t.finalTotal, 10120);
  });

  it("matches single-discount computeAgreedFinancialTerms", () => {
    const single = computeAgreedFinancialTerms({
      packagePrice: 1000,
      discountMode: "fixed",
      discountValue: 100,
      applyTax: true,
      taxRatePercent: 8,
    });
    const multi = computeAgreedFinancialTermsMulti({
      packagePrice: 1000,
      discountMode: "fixed",
      discountValue: 100,
      applyTax: true,
      taxRatePercent: 8,
    });
    assert.equal(multi.discountAmount, single.discountAmount);
    assert.equal(multi.taxableBase, single.taxableBase);
    assert.equal(multi.taxAmount, single.taxAmount);
    assert.equal(multi.finalTotal, single.finalTotal);
  });

  it("caps cumulative reductions at the package price", () => {
    const t = computeAgreedFinancialTermsMulti({
      packagePrice: 1000,
      adjustments: [
        { kind: "discount", description: "A", mode: "fixed", value: 800 },
        { kind: "credit", description: "B", mode: "fixed", value: 500 },
      ],
    });
    assert.equal(t.discountAmount, 1000);
    assert.equal(t.finalTotal, 0);
  });
});

describe("redistributeUnpaidInstallments", () => {
  it("proportionally redistributes remaining balance and preserves sum", () => {
    const out = redistributeUnpaidInstallments({
      unpaidAmounts: [4000, 4000, 2000],
      remainingBalance: 7000,
    });
    assert.deepEqual(out, [2800, 2800, 1400]);
    assert.equal(out.reduce((s, n) => s + n, 0), 7000);
  });

  it("handles zero prior unpaid by equal split", () => {
    const out = redistributeUnpaidInstallments({
      unpaidAmounts: [0, 0],
      remainingBalance: 100,
    });
    assert.equal(out.reduce((s, n) => s + n, 0), 100);
  });

  it("does not change agreed total when remaining equals current unpaid sum", () => {
    const out = redistributeUnpaidInstallments({
      unpaidAmounts: [3000, 2000],
      remainingBalance: 5000,
    });
    assert.deepEqual(out, [3000, 2000]);
  });
});
