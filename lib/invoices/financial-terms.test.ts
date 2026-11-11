import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeAgreedFinancialTerms,
  normalizePercent,
  taxableBaseFromRollups,
} from "@/lib/invoices/financial-terms";
import {
  computeInvoiceTotals,
  invoiceLineTypesForVenue,
  taxableAmountBeforeTax,
} from "@/lib/invoices/constants";
import { formatPackageSection } from "@/lib/commercial-selections/constants";
import { normalizeCommercialBookingPrefs } from "@/lib/booking-journey/venue-prefs";

describe("agreed financial terms (contract-first)", () => {
  it("tax-exclusive: discount reduces taxable base; tax added on top", () => {
    const t = computeAgreedFinancialTerms({
      packagePrice: 1000,
      discountMode: "fixed",
      discountValue: 100,
      applyTax: true,
      taxRatePercent: 8,
    });
    assert.equal(t.discountAmount, 100);
    assert.equal(t.taxableBase, 900);
    assert.equal(t.taxAmount, 72);
    assert.equal(t.finalTotal, 972);
    assert.equal(t.packagePrice, 1000);
  });

  it("percentage discount freezes dollars from package at apply time", () => {
    const t = computeAgreedFinancialTerms({
      packagePrice: 1000,
      discountMode: "percent",
      discountValue: 10,
      applyTax: false,
    });
    assert.equal(t.discountMode, "percent");
    assert.equal(t.discountValue, 10);
    assert.equal(t.discountAmount, 100);
    assert.equal(t.finalTotal, 900);
    assert.equal(t.taxApplied, false);
    assert.equal(t.taxAmount, 0);
  });

  it("enabling applyTax false never adds tax even with a rate", () => {
    const t = computeAgreedFinancialTerms({
      packagePrice: 1000,
      applyTax: false,
      taxRatePercent: 7,
    });
    assert.equal(t.taxAmount, 0);
    assert.equal(t.finalTotal, 1000);
    assert.equal(t.taxRatePercent, null);
  });

  it("rejects invalid percents", () => {
    assert.equal(normalizePercent(-1), null);
    assert.equal(normalizePercent(101), null);
    assert.equal(normalizePercent("7.25"), 7.25);
  });
});

describe("computeInvoiceTotals — deposits are not discounts", () => {
  it("ignores legacy deposit lines in discountAmount and total", () => {
    const totals = computeInvoiceTotals([
      { type: "package", amount: 1000 },
      { type: "deposit", amount: 250 },
      { type: "discount", amount: 100 },
      { type: "tax", amount: 72 },
    ]);
    assert.deepEqual(totals, {
      subtotal: 1000,
      discountAmount: 100,
      taxAmount: 72,
      total: 972,
    });
    assert.equal(taxableAmountBeforeTax(totals.subtotal, totals.discountAmount), 900);
    assert.equal(taxableBaseFromRollups(totals.subtotal, totals.discountAmount), 900);
  });

  it("hides Deposit Received from the add-line picker", () => {
    const types = invoiceLineTypesForVenue({ useTaxes: true, useDiscounts: true }).map((t) => t.value);
    assert.equal(types.includes("deposit"), false);
    assert.equal(types.includes("tax"), true);
    assert.equal(types.includes("discount"), true);
  });
});

describe("venue defaultTaxPercent", () => {
  it("defaults null and validates 0–100 with up to two decimal places", () => {
    assert.equal(normalizeCommercialBookingPrefs({}).defaultTaxPercent, null);
    assert.equal(
      normalizeCommercialBookingPrefs({ useTaxes: true, defaultTaxPercent: 7 }).defaultTaxPercent,
      7,
    );
    assert.equal(
      normalizeCommercialBookingPrefs({ defaultTaxPercent: 6.25 }).defaultTaxPercent,
      6.25,
    );
    assert.equal(
      normalizeCommercialBookingPrefs({ defaultTaxPercent: "7.50" }).defaultTaxPercent,
      7.5,
    );
    assert.equal(
      normalizeCommercialBookingPrefs({ defaultTaxPercent: 0 }).defaultTaxPercent,
      0,
    );
    assert.equal(
      normalizeCommercialBookingPrefs({ defaultTaxPercent: 100 }).defaultTaxPercent,
      100,
    );
    assert.equal(
      normalizeCommercialBookingPrefs({ defaultTaxPercent: -1 }).defaultTaxPercent,
      null,
    );
    assert.equal(
      normalizeCommercialBookingPrefs({ defaultTaxPercent: 100.0001 }).defaultTaxPercent,
      null,
    );
    assert.equal(
      normalizeCommercialBookingPrefs({ defaultTaxPercent: 101 }).defaultTaxPercent,
      null,
    );
    assert.equal(
      normalizeCommercialBookingPrefs({ defaultTaxPercent: "6.255" }).defaultTaxPercent,
      null,
    );
  });

  it("applies a 6.25% exclusive rate on the discounted package amount", () => {
    const t = computeAgreedFinancialTerms({
      packagePrice: 1000,
      applyTax: true,
      taxRatePercent: 6.25,
    });
    assert.equal(t.taxRatePercent, 6.25);
    assert.equal(t.taxAmount, 62.5);
    assert.equal(t.finalTotal, 1062.5);
  });
});

describe("formatPackageSection financial transparency", () => {
  it("shows package, discount, tax, agreed total, and deposit as allocation", () => {
    const text = formatPackageSection("Garden", 972, [], {
      packageAmount: 1000,
      discountAmount: 100,
      discountType: "percent",
      discountValue: 10,
      taxApplied: true,
      taxRatePercent: 8,
      taxAmount: 72,
      finalTotal: 972,
      depositAmount: 250,
    });
    assert.match(text, /Package price: \$1000\.00/);
    assert.match(text, /Discount \(10%\): −\$100\.00/);
    assert.match(text, /Tax \(8%\): \$72\.00/);
    assert.match(text, /Agreed total: \$972\.00/);
    assert.match(text, /Deposit \(payment allocation\): \$250\.00/);
    assert.doesNotMatch(text, /Package total:/);
  });
});
