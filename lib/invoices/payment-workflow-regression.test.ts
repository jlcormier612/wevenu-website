import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { buildInvoiceDocumentEmail } from "@/lib/invoices/invoice-document-email";
import { beginOutboundSend, endOutboundSend } from "@/lib/invoices/outbound";
import { buildPaymentRequestEmail } from "@/lib/invoices/payment-request-email";
import { venueCalendarDateFromValue, venueToday } from "@/lib/venue/timezone";

describe("A. business date", () => {
  it("venue-local today at the UTC day boundary is Sep 27 in America/New_York", () => {
    assert.equal(venueToday("America/New_York", new Date("2026-09-28T03:00:00Z")), "2026-09-27");
  });

  it("signed_at timestamp displays the venue-local calendar date", () => {
    assert.equal(
      venueCalendarDateFromValue("2026-09-28T02:00:00.000Z", "America/New_York"),
      "2026-09-27",
    );
  });

  it("date-only due_date remains unchanged", () => {
    assert.equal(venueCalendarDateFromValue("2026-09-27", "America/New_York"), "2026-09-27");
  });

  it("booking journey payment sheet receives today, not a UTC ISO fallback", () => {
    const panel = readFileSync("components/booking-journey/booking-journey-panel.tsx", "utf8");
    const sheet = readFileSync("components/booking-journey/setup-payments-sheet.tsx", "utf8");
    assert.match(panel, /today=\{businessToday\}/);
    assert.match(panel, /venueToday\(venueTimezone\)/);
    assert.doesNotMatch(sheet, /new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/);
    const contract = readFileSync("components/contracts/contract-detail.tsx", "utf8");
    assert.match(contract, /venueCalendarDateFromValue\(s\.signedAt, venueTimezone\)/);
    assert.doesNotMatch(contract, /signedAt\.slice\(0, 10\)/);
  });
});

describe("B/C. configured default and custom schedule data flow", () => {
  it("does not remap remainingBalanceMode final onto deposit_remaining as a FAST_PRESET id", () => {
    const panel = readFileSync("components/booking-journey/booking-journey-panel.tsx", "utf8");
    assert.doesNotMatch(
      panel,
      /remainingBalanceMode === "final"\s*\n\s*\? "deposit_remaining"/,
    );
    assert.match(panel, /remainingBalanceMode=\{journey\.prefs\.remainingBalanceMode\}/);
    assert.match(panel, /customSchedule=\{journey\.prefs\.defaultCustomSchedule\}/);
  });

  it("carries customSchedule into PaymentPlanBuilder", () => {
    const sheet = readFileSync("components/booking-journey/setup-payments-sheet.tsx", "utf8");
    const builder = readFileSync("components/payments/payment-plan-builder.tsx", "utf8");
    assert.match(sheet, /customSchedule=\{customSchedule\}/);
    assert.match(builder, /customSchedule/);
    assert.match(builder, /draftsFromCustomTemplate/);
    assert.match(builder, /resolveConfiguredPlanSeed/);
  });
});

describe("E. request initial payment review", () => {
  const detail = readFileSync("components/invoices/invoice-detail.tsx", "utf8");
  const actions = readFileSync("app/(app)/invoices/actions.ts", "utf8");

  it("opens review before send and does not send from the Request button", () => {
    assert.match(detail, /openPaymentRequestReview/);
    assert.match(detail, /previewPaymentRequestAction/);
    assert.match(detail, /Send payment request/);
    assert.match(detail, /payment-request-review/);
    assert.doesNotMatch(
      detail,
      /onClick=\{sendInvoiceEmail\}/,
    );
  });

  it("preview of the payment request does not publish or send", () => {
    assert.match(actions, /previewPaymentRequestAction/);
    assert.match(actions, /loadInvoiceOutboundContext\(invoiceId, \{ publish: false \}\)/);
    assert.match(actions, /sendInvoiceEmailAction/);
    assert.match(actions, /beginOutboundSend\("payment_request"/);
    assert.match(actions, /loadInvoiceOutboundContext\(invoiceId, \{ publish: true \}\)/);
  });

  it("reviewed payment-request content matches the email builder", () => {
    const email = buildPaymentRequestEmail({
      clientFirstName: "Betty",
      clientEmail: "betty@example.com",
      venueName: "Jen's Fancy Venue",
      venueEmail: "venue@example.com",
      invoiceLabel: "Wedding invoice",
      invoiceNumber: "INV-2026-TEST",
      dueNow: {
        kind: "next_installment",
        amount: 2500,
        dueDate: "2026-09-27",
        label: "Initial Payment",
        obligationKind: "deposit",
      },
      dueDate: "September 27, 2026",
      totalContracted: 10000,
      paidToDate: 0,
      remainingAfter: 7500,
      balanceDue: 10000,
      portalPayUrl: "https://example.test/p/token?item=pay-1",
    });
    assert.equal(email.recipient, "betty@example.com");
    assert.equal(email.clientName, "Betty");
    assert.equal(email.amountDueNow, "$2,500.00");
    assert.equal(email.dueDate, "September 27, 2026");
    assert.match(email.text, /Total contracted: \$10,000\.00/);
    assert.match(email.text, /Paid to date: \$0\.00/);
    assert.match(email.text, /Remaining after this payment: \$7,500\.00/);
    assert.match(email.text, /Jen's Fancy Venue/);
    assert.match(email.text, /Pay online: https:\/\/example\.test\/p\/token\?item=pay-1/);
    assert.match(email.subject, /payment request/);
    assert.doesNotMatch(email.text, /This is a copy of your invoice and payment plan/);
  });
});

describe("E. send-once lock", () => {
  it("opening review / cancel send zero emails; explicit send is locked against duplicates", () => {
    const id = `lock-${Date.now()}`;
    assert.equal(beginOutboundSend("payment_request", id), true);
    assert.equal(beginOutboundSend("payment_request", id), false);
    endOutboundSend("payment_request", id);
    assert.equal(beginOutboundSend("payment_request", id), true);
    endOutboundSend("payment_request", id);
  });
});

describe("F. payment link publication", () => {
  const outbound = readFileSync("lib/invoices/outbound.ts", "utf8");
  const actions = readFileSync("app/(app)/invoices/actions.ts", "utf8");
  const rpc = readFileSync(
    "supabase/migrations/20261403900000_portal_payments_omit_line_item_notes.sql",
    "utf8",
  );
  const shell = readFileSync("components/portal/payment-access-shell.tsx", "utf8");

  it("publishes a draft invoice before the payment-request email, without an Event Order gate", () => {
    assert.match(outbound, /publishInvoiceForCustomerAccess/);
    assert.match(outbound, /updateInvoiceStatus\(invoiceId, "sent"\)/);
    assert.match(actions, /publish: true/);
    assert.doesNotMatch(actions, /eventOrderId/);
  });

  it("keeps the draft publication guard on get_portal_payments", () => {
    assert.match(rpc, /inv\.status != 'draft'/);
  });

  it("invalid token and Stripe-unavailable remain distinct", () => {
    assert.match(shell, /This payment link is not valid/);
    assert.match(shell, /Online payments unavailable/);
    assert.match(shell, /onlinePaymentsReady/);
  });
});

describe("G. full payment plan / invoice document", () => {
  const detail = readFileSync("components/invoices/invoice-detail.tsx", "utf8");
  const actions = readFileSync("app/(app)/invoices/actions.ts", "utf8");

  it("exposes a distinct document-copy action with review before send", () => {
    assert.match(detail, /Send copy of payment plan and invoice/);
    assert.match(detail, /previewInvoiceDocumentCopyAction/);
    assert.match(detail, /sendInvoiceDocumentCopyAction/);
    assert.match(detail, /invoice-document-review/);
    assert.match(actions, /beginOutboundSend\("document_copy"/);
    assert.match(actions, /sourceType: "invoice_document_copy"/);
  });

  it("document email includes the entire installment schedule and is not a payment request", () => {
    const email = buildInvoiceDocumentEmail({
      clientFirstName: "Betty",
      clientEmail: "betty@example.com",
      clientName: "Betty Booked",
      venueName: "Jen's Fancy Venue",
      invoiceLabel: "Wedding invoice",
      invoiceNumber: "INV-2026-TEST",
      eventDate: "2026-10-17",
      totalContracted: 10000,
      paidToDate: 2500,
      balanceDue: 7500,
      scheduleLines: [
        { label: "Initial Payment", amount: 2500, dueDate: "2026-09-27", status: "pending" },
        { label: "Planning Payment 1", amount: 2500, dueDate: "2026-06-19", status: "pending" },
        { label: "Planning Payment 2", amount: 2500, dueDate: "2026-08-18", status: "pending" },
        { label: "Final Payment", amount: 2500, dueDate: "2026-09-17", status: "pending" },
      ],
      documentsUrl: "https://example.test/p/token#documents",
    });
    assert.match(email.subject, /payment plan and invoice/);
    assert.match(email.text, /Betty Booked/);
    assert.match(email.text, /Jen's Fancy Venue/);
    assert.match(email.text, /INV-2026-TEST/);
    assert.match(email.text, /Total contracted: \$10,000\.00/);
    assert.match(email.text, /Paid to date: \$2,500\.00/);
    assert.match(email.text, /Balance remaining: \$7,500\.00/);
    assert.match(email.text, /Initial Payment: \$2,500\.00/);
    assert.match(email.text, /Planning Payment 1: \$2,500\.00/);
    assert.match(email.text, /Planning Payment 2: \$2,500\.00/);
    assert.match(email.text, /Final Payment: \$2,500\.00/);
    assert.match(email.text, /View in your documents/);
    assert.match(email.text, /not a request to pay a specific installment/);
    assert.doesNotMatch(email.text, /Pay online:/);
  });

  it("Preview payment plan no longer sends the payment-request email", () => {
    assert.match(detail, /Customer-facing invoice/);
    assert.doesNotMatch(detail, /Send by email/);
  });
});

describe("H. payment plan button semantics remain distinct", () => {
  const detail = readFileSync("components/invoices/invoice-detail.tsx", "utf8");
  it("keeps Preview, View, and Edit as separate actions", () => {
    assert.match(detail, /Preview payment plan/);
    assert.match(detail, /View payment plan/);
    assert.match(detail, /Edit payment plan/);
    assert.match(detail, /Request initial payment/);
    assert.match(detail, /Send copy of payment plan and invoice/);
  });
});
