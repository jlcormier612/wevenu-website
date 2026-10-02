import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeInvoiceTotals,
  invoiceLineTypesForVenue,
  taxableAmountBeforeTax,
} from "@/lib/invoices/constants";
import { normalizeCommercialBookingPrefs } from "@/lib/booking-journey/venue-prefs";

describe("venue tax and discount controls", () => {
  it("defaults to neither", () => {
    const prefs = normalizeCommercialBookingPrefs({});
    const types = invoiceLineTypesForVenue(prefs).map((t) => t.value);
    assert.equal(types.includes("tax"), false);
    assert.equal(types.includes("discount"), false);
    assert.equal(types.includes("package"), true);
  });

  it("exposes only the enabled controls", () => {
    const tax = invoiceLineTypesForVenue({ useTaxes: true, useDiscounts: false }).map((t) => t.value);
    assert.equal(tax.includes("tax"), true);
    assert.equal(tax.includes("discount"), false);
    const discount = invoiceLineTypesForVenue({ useTaxes: false, useDiscounts: true }).map((t) => t.value);
    assert.equal(discount.includes("discount"), true);
    assert.equal(discount.includes("tax"), false);
    const both = invoiceLineTypesForVenue(
      normalizeCommercialBookingPrefs({ useTaxes: true, useDiscounts: true }),
    ).map((t) => t.value);
    assert.equal(both.includes("tax"), true);
    assert.equal(both.includes("discount"), true);
  });

  it("totals and taxable basis follow the line amounts", () => {
    const totals = computeInvoiceTotals([
      { type: "package", amount: 1000 },
      { type: "discount", amount: 100 },
      { type: "tax", amount: 72 },
    ]);
    assert.deepEqual(totals, { subtotal: 1000, discountAmount: 100, taxAmount: 72, total: 972 });
    assert.equal(taxableAmountBeforeTax(totals.subtotal, totals.discountAmount), 900);
  });

  it("leaves a no-adjustment invoice unchanged", () => {
    const totals = computeInvoiceTotals([{ type: "package", amount: 500 }]);
    assert.equal(totals.total, 500);
    assert.equal(totals.taxAmount, 0);
    assert.equal(totals.discountAmount, 0);
  });
});
