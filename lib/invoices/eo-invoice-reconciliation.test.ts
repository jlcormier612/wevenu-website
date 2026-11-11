import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  eventOrderBillableSubtotal,
  eventOrderDeliverySubtotal,
  moneyFiguresAgree,
  reconcileEventOrderInvoicePayable,
} from "@/lib/invoices/eo-invoice-reconciliation";

/** Sandbox B2P fixture shape: delivery $2453, billable $2133, tax 6.25%. */
const fixtureLines = [
  { id: "inc-1", amount: 300, unitPrice: 300, isIncluded: true },
  { id: "inc-2", amount: 20, unitPrice: 20, isIncluded: true },
  { id: "bill-bar", amount: 750, unitPrice: 750, isIncluded: false },
  { id: "bill-coord", amount: 500, unitPrice: 500, isIncluded: false },
  { id: "bill-arbor", amount: 350, unitPrice: 350, isIncluded: false },
  { id: "bill-rest", amount: 533, unitPrice: 533, isIncluded: false },
];

describe("Event Order ↔ invoice payable reconciliation", () => {
  it("separates delivery subtotal from billable invoice charges", () => {
    assert.equal(eventOrderDeliverySubtotal(fixtureLines), 2453);
    assert.equal(eventOrderBillableSubtotal(fixtureLines), 2133);
  });

  it("builds payable as billable EO + stored tax (not delivery subtotal)", () => {
    const result = reconcileEventOrderInvoicePayable({
      eventOrderLines: fixtureLines,
      storedInvoiceLines: [{ type: "tax", amount: 133.31 }],
    });
    assert.equal(result.deliverySubtotal, 2453);
    assert.equal(result.billableSubtotal, 2133);
    assert.equal(result.includedOrNonBillable, 320);
    assert.equal(result.taxAmount, 133.31);
    assert.equal(result.payableTotal, 2266.31);
    assert.equal(moneyFiguresAgree(result.payableTotal, 2453), false);
    assert.equal(moneyFiguresAgree(result.payableTotal, 133.31), false);
  });

  it("does not treat a tax-only stored draft total as the EO payable", () => {
    const storedOnly = reconcileEventOrderInvoicePayable({
      eventOrderLines: [],
      storedInvoiceLines: [{ type: "tax", amount: 133.31 }],
    });
    assert.equal(storedOnly.payableTotal, 133.31);

    const withEo = reconcileEventOrderInvoicePayable({
      eventOrderLines: fixtureLines,
      storedInvoiceLines: [{ type: "tax", amount: 133.31 }],
    });
    assert.equal(moneyFiguresAgree(storedOnly.payableTotal, withEo.payableTotal), false);
    assert.equal(withEo.payableTotal, 2266.31);
  });

  it("applies discounts before tax lines in the payable total", () => {
    const result = reconcileEventOrderInvoicePayable({
      eventOrderLines: fixtureLines,
      storedInvoiceLines: [
        { type: "discount", amount: 100 },
        { type: "tax", amount: 127.06 },
      ],
    });
    assert.equal(result.discountAmount, 100);
    assert.equal(result.payableTotal, 2160.06);
  });

  it("freeze-on-send refreshes percent tax against frozen EO lines before status change", () => {
    const src = readFileSync(resolve("lib/invoices/service.ts"), "utf8");
    const freeze = src.slice(src.indexOf("if (invoice.status === \"draft\" && invoice.eventOrderId)"));
    const block = freeze.slice(0, freeze.indexOf("await repo.updateInvoiceStatus(c, venueId, invoiceId, status, { brandingSnapshot })"));
    assert.match(block, /insertFrozenLinesFromEventOrder/);
    assert.match(block, /afterLineItemMutation/);
    const afterIdx = block.indexOf("afterLineItemMutation");
    const statusIdx = block.indexOf("updateInvoiceStatus");
    assert.ok(afterIdx > 0 && statusIdx > afterIdx, "tax refresh must run after freeze insert and before status update");
  });

  it("workspace invoice lists project draft EO totals through getInvoice", () => {
    const src = readFileSync(resolve("lib/invoices/service.ts"), "utf8");
    const scoped = src.slice(
      src.indexOf("export async function getInvoicesForClientOrEvent"),
      src.indexOf("export async function getInvoice("),
    );
    assert.match(scoped, /projectDraftEventOrderInvoiceTotals|getInvoice\(/);
  });
});
