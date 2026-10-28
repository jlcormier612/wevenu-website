import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { BOOKING_INVOICE_LABEL, SELECTIONS_INVOICE_DISPLAY_NAME } from "@/lib/invoices/display-name";
import {
  bareInvoiceNextStepCopy,
  labelForSchedule,
  portalInvoiceLabel,
} from "@/lib/portal/payment-obligations";

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

  it("keeps Event & Inventory Selections distinguishable by invoice number", () => {
    assert.equal(
      portalInvoiceLabel({
        displayName: SELECTIONS_INVOICE_DISPLAY_NAME,
        invoiceNumber: "INV-1",
      }),
      `${SELECTIONS_INVOICE_DISPLAY_NAME} · INV-1`,
    );
    assert.notEqual(SELECTIONS_INVOICE_DISPLAY_NAME, BOOKING_INVOICE_LABEL);
  });

  it("labels incremental amending selections as Additional charges", () => {
    assert.equal(
      portalInvoiceLabel({
        displayName: SELECTIONS_INVOICE_DISPLAY_NAME,
        invoiceNumber: "INV-2",
        amendsInvoiceId: "inv-1",
      }),
      "Additional charges · INV-2",
    );
  });

  it("does not rewrite a custom invoice name", () => {
    assert.equal(portalInvoiceLabel({ displayName: "Wedding Deposit" }), "Wedding Deposit");
    assert.equal(portalInvoiceLabel({ displayName: null }), "Invoice");
  });

  it("explains bare-invoice next step without implying plan inheritance", () => {
    assert.match(bareInvoiceNextStepCopy(250), /not covered by another invoice/i);
    assert.match(bareInvoiceNextStepCopy(0), /no remaining balance/i);
  });
});

describe("selections invoice balance copy", () => {
  it("Payments clarifies combined balance and bare-invoice next step", () => {
    const src = readFileSync(resolve("components/portal/payment-section.tsx"), "utf8");
    assert.match(src, /Balance:/);
    assert.match(src, /bareInvoiceNextStepCopy/);
    assert.match(src, /Combined outstanding/);
    assert.match(src, /does not inherit/);
    assert.doesNotMatch(src, /No payment plan on this invoice yet\./);
  });

  it("Documents shows Balance, not due, on an invoice card", () => {
    const src = readFileSync(resolve("components/portal/couple-documents-section.tsx"), "utf8");
    const invoiceCard = src.slice(src.indexOf("function InvoiceCard"), src.indexOf("function DocRow"));
    assert.match(invoiceCard, /Balance:/);
    assert.doesNotMatch(invoiceCard, /due<\/span>/);
  });
});
