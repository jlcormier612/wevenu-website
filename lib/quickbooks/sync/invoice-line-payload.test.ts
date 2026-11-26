import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildQuickBooksInvoiceLinePayload } from "@/lib/quickbooks/sync/invoice-line-payload";

describe("buildQuickBooksInvoiceLinePayload", () => {
  it("maps package lines to SalesItemLineDetail under the placeholder item", () => {
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
    assert.equal(payload.Line.length, 1);
    assert.equal(payload.Line[0]?.DetailType, "SalesItemLineDetail");
    assert.equal(payload.totalTax, 0);
    assert.equal(payload.TxnTaxDetail, undefined);
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
    assert.equal(payload.totalDiscount, 100);
    assert.equal(payload.Line.length, 2);
    assert.equal(payload.Line[1]?.DetailType, "DiscountLineDetail");
    assert.equal(payload.Line[1]?.Amount, 100);
    assert.equal(
      payload.Line.filter((l) => l.DetailType === "SalesItemLineDetail").length,
      1,
    );
  });

  it("moves tax into TxnTaxDetail instead of SalesItem income lines", () => {
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
    assert.equal(payload.totalTax, 80);
    assert.deepEqual(payload.TxnTaxDetail, { TotalTax: 80 });
    assert.equal(payload.Line.length, 1);
    assert.equal(payload.Line[0]?.DetailType, "SalesItemLineDetail");
    assert.equal(
      payload.Line.some((l) => (l.Description || "").toLowerCase() === "tax"),
      false,
    );
  });

  it("handles package + discount + tax without double-counting tax as a sales line", () => {
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
    assert.equal(payload.totalDiscount, 100);
    assert.equal(payload.totalTax, 72);
    assert.deepEqual(payload.TxnTaxDetail, { TotalTax: 72 });
    assert.equal(payload.Line.length, 2);
    assert.ok(payload.Line.every((l) => l.DetailType !== "SalesItemLineDetail" || l.Amount === 1000));
  });
});
