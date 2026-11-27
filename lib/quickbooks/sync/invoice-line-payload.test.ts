import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { buildQuickBooksInvoiceLinePayload } from "@/lib/quickbooks/sync/invoice-line-payload";

describe("buildQuickBooksInvoiceLinePayload", () => {
  it("maps non-taxable package lines with TaxCodeRef NON and NotApplicable", () => {
    const payload = buildQuickBooksInvoiceLinePayload(
      [
        {
          type: "package",
          description: "Venue package",
          quantity: 1,
          unit_price: 1000,
          amount: 1000,
        },
      ],
      "item-1",
    );
    assert.equal(payload.taxable, false);
    assert.equal(payload.GlobalTaxCalculation, "NotApplicable");
    assert.equal(payload.Line.length, 1);
    assert.equal(payload.Line[0]?.DetailType, "SalesItemLineDetail");
    if (payload.Line[0]?.DetailType === "SalesItemLineDetail") {
      assert.equal(payload.Line[0].SalesItemLineDetail.TaxCodeRef.value, "NON");
    }
    assert.equal(payload.expectedTotal, 1000);
  });

  it("maps discount lines to DiscountLineDetail and never as SalesItem revenue", () => {
    const payload = buildQuickBooksInvoiceLinePayload(
      [
        {
          type: "package",
          description: "Venue package",
          quantity: 1,
          unit_price: 1000,
          amount: 1000,
        },
        {
          type: "discount",
          description: "Discount",
          quantity: 1,
          unit_price: 100,
          amount: 100,
        },
      ],
      "item-1",
    );
    assert.equal(payload.htcDiscountAmount, 100);
    assert.equal(payload.Line.length, 2);
    assert.equal(payload.Line[1]?.DetailType, "DiscountLineDetail");
    assert.equal(payload.expectedTotal, 900);
  });

  it("marks taxable invoices with TaxCodeRef TAX and does not post tax as SalesItem", () => {
    const payload = buildQuickBooksInvoiceLinePayload(
      [
        {
          type: "package",
          description: "Venue package",
          quantity: 1,
          unit_price: 1000,
          amount: 1000,
        },
        {
          type: "tax",
          description: "Tax",
          quantity: 1,
          unit_price: 80,
          amount: 80,
        },
      ],
      "item-1",
    );
    assert.equal(payload.taxable, true);
    assert.equal(payload.GlobalTaxCalculation, "TaxExcluded");
    assert.equal(payload.htcTaxAmount, 80);
    assert.equal(payload.Line.length, 1);
    if (payload.Line[0]?.DetailType === "SalesItemLineDetail") {
      assert.equal(payload.Line[0].SalesItemLineDetail.TaxCodeRef.value, "TAX");
    }
    assert.equal(payload.expectedTotal, 1080);
    assert.equal(
      payload.Line.some((l) => (l.Description || "").toLowerCase() === "tax"),
      false,
    );
  });

  it("handles package + discount + tax expected total without tax sales lines", () => {
    const payload = buildQuickBooksInvoiceLinePayload(
      [
        {
          type: "package",
          description: "Venue package",
          quantity: 1,
          unit_price: 1000,
          amount: 1000,
        },
        {
          type: "discount",
          description: "Discount",
          quantity: 1,
          unit_price: 100,
          amount: 100,
        },
        {
          type: "tax",
          description: "Tax",
          quantity: 1,
          unit_price: 72,
          amount: 72,
        },
      ],
      "item-1",
    );
    assert.equal(payload.htcDiscountAmount, 100);
    assert.equal(payload.htcTaxAmount, 72);
    assert.equal(payload.expectedTotal, 972);
    assert.equal(payload.Line.length, 2);
  });
});

describe("syncInvoice tax failure policy", () => {
  it("does not contain a tax-as-SalesItem fallback path", () => {
    const src = readFileSync("lib/quickbooks/sync/invoice.ts", "utf8");
    assert.doesNotMatch(src, /taxFallbackLines|fallback to non-tax-coded sales lines/i);
    assert.match(src, /does not match Hello to Cheers total/);
    assert.match(src, /tax was not posted as revenue and was not dropped/);
  });
});

describe("invoice sync deterministic failures", () => {
  it("marks empty line-item invoices as non-retryable", () => {
    const src = readFileSync("lib/quickbooks/sync/invoice.ts", "utf8");
    const idx = src.indexOf("Invoice has no line items to sync.");
    assert.ok(idx > 0);
    const window = src.slice(idx, idx + 120);
    assert.match(window, /retryable:\s*false/);
  });
});
