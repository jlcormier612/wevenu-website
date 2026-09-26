import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  addToExistingPlan,
  buildSelectionsFinancialImpact,
  financialImpactCopy,
  invoiceToOpenForEventOrder,
} from "@/lib/client-choices/selections-billing";
import { unbilledSelectionsTotal } from "@/lib/client-choices/unbilled-delta";
import {
  frozenEventOrderLineIds,
  isPackageBookingCommitmentLines,
  packageBookingCommitmentInvoiceIds,
} from "@/lib/invoices/booking-commitment";
import {
  SELECTIONS_INVOICE_DISPLAY_NAME,
  coupleDocumentInvoiceName,
} from "@/lib/invoices/display-name";
import {
  invoicesWithoutPaymentPlan,
  labelForSchedule,
} from "@/lib/portal/payment-obligations";
import { selectCanonicalPaymentSchedules } from "@/lib/portal/payment-schedules";

const bar = { id: "eo-bar", amount: 750, unitPrice: 750, isIncluded: false };
const veg = { id: "eo-veg", amount: 0, unitPrice: 0, isIncluded: true };

describe("unbilled selections", () => {
  it("ignores included and zero-price lines", () => {
    assert.equal(unbilledSelectionsTotal([veg, bar], []), 750);
    assert.equal(unbilledSelectionsTotal([veg], []), 0);
  });

  it("excludes lines frozen on a non-void invoice", () => {
    assert.equal(unbilledSelectionsTotal([bar, veg], ["eo-bar"]), 0);
  });

  it("counts a line again when the only freeze is on a void invoice", () => {
    const lines = [
      { invoiceId: "voided", type: "item", eventOrderLineId: "eo-bar" },
    ];
    assert.deepEqual(frozenEventOrderLineIds(lines, ["sent-invoice"]), []);
    assert.equal(unbilledSelectionsTotal([bar], frozenEventOrderLineIds(lines, ["sent-invoice"])), 750);
  });
});

describe("selections invoice decisions", () => {
  const booking = {
    id: "booking",
    status: "sent" as const,
    invoiceNumber: "INV-BOOK",
    eventOrderId: null,
    displayName: "Garden Package",
  };
  const eoDraft = {
    id: "eo-draft",
    status: "draft" as const,
    invoiceNumber: "INV-EO",
    eventOrderId: "eo-1",
  };
  const eoSent = {
    id: "eo-sent",
    status: "sent" as const,
    invoiceNumber: "INV-EO-SENT",
    eventOrderId: "eo-1",
  };

  it("does not treat a booking invoice as an Event Order invoice", () => {
    assert.equal(invoiceToOpenForEventOrder([booking], "eo-1"), null);
    assert.equal(addToExistingPlan([booking], "eo-1").kind, "unavailable");
    const impact = buildSelectionsFinancialImpact({
      eventOrderId: "eo-1",
      clientId: "client",
      lines: [bar, veg],
      invoices: [booking],
      frozenEventOrderLineIds: [],
    });
    assert.equal(impact.unbilledAmount, 750);
    assert.equal(impact.eoInvoice, null);
    assert.equal(
      financialImpactCopy(impact.unbilledAmount, impact.eoInvoice),
      "These finalized selections add $750.00. Nothing has been billed yet.",
    );
  });

  it("reuses the same Event Order invoice instead of inserting another", () => {
    assert.equal(invoiceToOpenForEventOrder([eoSent, eoDraft], "eo-1")?.id, "eo-draft");
    assert.equal(invoiceToOpenForEventOrder([eoSent], "eo-1")?.id, "eo-sent");
  });

  it("amends a sent Event Order invoice and opens a draft", () => {
    assert.deepEqual(addToExistingPlan([eoSent], "eo-1"), { kind: "amend", invoiceId: "eo-sent" });
    assert.deepEqual(addToExistingPlan([eoDraft], "eo-1"), { kind: "open", invoiceId: "eo-draft" });
    assert.deepEqual(addToExistingPlan([eoSent, eoDraft], "eo-1"), { kind: "open", invoiceId: "eo-draft" });
  });

  it("hides financial impact when nothing is unbilled", () => {
    assert.equal(financialImpactCopy(0, null), null);
  });
});

describe("booking commitment link refusal", () => {
  it("recognizes a package line with no event order line id", () => {
    assert.equal(
      isPackageBookingCommitmentLines([{ type: "package", eventOrderLineId: null }]),
      true,
    );
    assert.equal(
      isPackageBookingCommitmentLines([
        { type: "package", eventOrderLineId: null },
        { type: "item", eventOrderLineId: "eo-line" },
      ]),
      false,
    );
    assert.deepEqual(
      packageBookingCommitmentInvoiceIds([
        { invoiceId: "booking", type: "package", eventOrderLineId: null },
        { invoiceId: "selections", type: "item", eventOrderLineId: "eo-bar" },
      ]),
      ["booking"],
    );
  });
});

describe("portal invoice distinction", () => {
  it("keeps a schedule per invoice instead of the newest only", () => {
    const schedules = selectCanonicalPaymentSchedules([
      { id: "older", invoiceId: "booking", createdAt: "2026-01-01", title: "Booking", lineItems: [] },
      { id: "newer", invoiceId: "selections", createdAt: "2026-09-01", title: "Selections", lineItems: [] },
    ]);
    assert.deepEqual(schedules.map((row) => row.invoiceId), ["selections", "booking"]);
    const invoices = [
      { id: "booking", invoiceNumber: "INV-BOOK", displayName: "Garden Package", status: "sent", balanceDue: 2400 },
      { id: "selections", invoiceNumber: "INV-SEL", displayName: SELECTIONS_INVOICE_DISPLAY_NAME, status: "sent", balanceDue: 750, dueDate: null },
    ];
    assert.equal(labelForSchedule(schedules[0], invoices), SELECTIONS_INVOICE_DISPLAY_NAME);
    assert.equal(labelForSchedule(schedules[1], invoices), "Garden Package");
    assert.notEqual(
      coupleDocumentInvoiceName(SELECTIONS_INVOICE_DISPLAY_NAME),
      coupleDocumentInvoiceName("Garden Package"),
    );
  });

  it("shows a sent invoice with no plan as its own obligation", () => {
    const bare = invoicesWithoutPaymentPlan(
      [{ id: "selections", invoiceNumber: "INV-SEL", displayName: SELECTIONS_INVOICE_DISPLAY_NAME, status: "sent", balanceDue: 750 }],
      [{ id: "plan", invoiceId: "booking", title: "Booking payments" }],
    );
    assert.equal(bare.length, 1);
    assert.equal(bare[0]?.id, "selections");
  });
});

describe("financial path stays off finalize and payment plans", () => {
  it("finalize does not create an invoice", () => {
    const src = readFileSync("lib/client-choices/service.ts", "utf8");
    const finalize = src.slice(src.indexOf("export async function finalizeClientChoices"));
    assert.equal(finalize.includes("createInvoice"), false);
    assert.equal(finalize.includes("createPaymentSchedule"), false);
  });

  it("create new invoice sets the selections name and does not create a payment plan", () => {
    const src = readFileSync("app/(app)/events/[id]/event-order-actions.ts", "utf8");
    assert.match(src, /SELECTIONS_INVOICE_DISPLAY_NAME/);
    assert.match(src, /dueDate: ""/);
    assert.match(src, /invoiceToOpenForEventOrder/);
    assert.equal(src.includes("createPaymentSchedule"), false);
    assert.match(src, /addToExistingPlan/);
    assert.match(src, /createAmendedInvoice/);
  });

  it("linking refuses a package booking invoice", () => {
    const src = readFileSync("lib/invoices/service.ts", "utf8");
    assert.match(src, /isPackageBookingCommitmentLines/);
    assert.match(src, /cannot be linked to an Event Order/);
  });
});
