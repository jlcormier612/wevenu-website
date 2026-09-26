import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { BOOKING_INVOICE_LABEL, SELECTIONS_INVOICE_DISPLAY_NAME } from "@/lib/invoices/display-name";
import { labelForSchedule, portalInvoiceLabel } from "@/lib/portal/payment-obligations";

describe("portal invoice facing labels", () => {
  it("labels the generic booking invoice heading Booking Invoice", () => {
    assert.equal(portalInvoiceLabel({ displayName: "Invoice" }), BOOKING_INVOICE_LABEL);
    assert.equal(
      labelForSchedule(
        { id: "sch-1", invoiceId: "inv-book" },
        [{ id: "inv-book", invoiceNumber: "INV-2026-92BC93", displayName: "Invoice" }],
      ),
      BOOKING_INVOICE_LABEL,
    );
  });

  it("keeps Event & Inventory Selections on the later invoice", () => {
    assert.equal(
      portalInvoiceLabel({ displayName: SELECTIONS_INVOICE_DISPLAY_NAME }),
      SELECTIONS_INVOICE_DISPLAY_NAME,
    );
    assert.notEqual(SELECTIONS_INVOICE_DISPLAY_NAME, BOOKING_INVOICE_LABEL);
  });

  it("does not rewrite a custom invoice name", () => {
    assert.equal(portalInvoiceLabel({ displayName: "Wedding Deposit" }), "Wedding Deposit");
    assert.equal(portalInvoiceLabel({ displayName: null }), "Invoice");
  });
});

describe("selections invoice balance copy", () => {
  it("Payments does not call an unscheduled balance due", () => {
    const src = readFileSync(resolve("components/portal/payment-section.tsx"), "utf8");
    assert.match(src, /Balance:/);
    assert.match(src, /No payment schedule has been set for this invoice yet\./);
    assert.doesNotMatch(src, /No payment plan on this invoice yet\./);
  });

  it("Documents shows Balance, not due, on an invoice card", () => {
    const src = readFileSync(resolve("components/portal/couple-documents-section.tsx"), "utf8");
    const invoiceCard = src.slice(src.indexOf("function InvoiceCard"), src.indexOf("function DocRow"));
    assert.match(invoiceCard, /Balance:/);
    assert.doesNotMatch(invoiceCard, /due<\/span>/);
  });
});
