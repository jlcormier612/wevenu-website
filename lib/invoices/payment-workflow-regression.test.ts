import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { buildInvoiceAndPaymentPlanEmail } from "@/lib/invoices/invoice-and-payment-plan-email";
import { beginOutboundSend, endOutboundSend } from "@/lib/invoices/outbound";
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

describe("E. canonical Preview and Send", () => {
  const detail = readFileSync("components/invoices/invoice-detail.tsx", "utf8");
  const actions = readFileSync("app/(app)/invoices/actions.ts", "utf8");

  it("opens branded preview before send and does not send from Preview", () => {
    assert.match(detail, /previewInvoiceAndPaymentPlanAction/);
    assert.match(detail, /sendInvoiceAndPaymentPlanAction/);
    assert.match(detail, /InvoicePrintDocument/);
    assert.match(detail, /data-testid="send-invoice-and-payment-plan"/);
    assert.doesNotMatch(detail, /Request initial payment/);
    assert.doesNotMatch(detail, /Send copy of payment plan and invoice/);
    assert.doesNotMatch(detail, /Send payment request/);
  });

  it("preview of send does not publish; send publishes", () => {
    const preview = actions.slice(
      actions.indexOf("export async function previewInvoiceAndPaymentPlanAction"),
      actions.indexOf("export async function sendInvoiceAndPaymentPlanAction"),
    );
    assert.match(preview, /publish: false/);
    const send = actions.slice(actions.indexOf("export async function sendInvoiceAndPaymentPlanAction"));
    assert.match(send, /publish: true/);
    assert.match(send, /beginOutboundSend\("payment_request"/);
  });

  it("one customer email includes schedule context and financial invoice CTA when due", () => {
    const email = buildInvoiceAndPaymentPlanEmail({
      clientFirstName: "Betty",
      clientEmail: "betty@example.com",
      clientName: "Betty Booked",
      venueName: "Jen's Fancy Venue",
      venueEmail: "venue@example.com",
      invoiceLabel: "Wedding invoice",
      invoiceNumber: "INV-2026-TEST",
      eventDate: "2026-10-17",
      totalContracted: 10000,
      paidToDate: 0,
      balanceDue: 10000,
      dueNow: {
        kind: "next_installment",
        amount: 2500,
        dueDate: "2026-09-27",
        label: "Initial Payment",
        obligationKind: "deposit",
      },
      dueDateLabel: "September 27, 2026",
      remainingAfter: 7500,
      scheduleLines: [
        { label: "Initial Payment", amount: 2500, dueDate: "2026-09-27", status: "pending" },
        { label: "Planning Payment 1", amount: 2500, dueDate: "2026-12-12", status: "pending" },
        { label: "Final Payment", amount: 5000, dueDate: "2027-03-11", status: "pending" },
      ],
      invoicePlanUrl: "https://example.test/p/fin-token?item=pay-1",
    });
    assert.equal(email.recipient, "betty@example.com");
    assert.match(email.subject, /invoice and payment plan/);
    assert.match(email.text, /Total contracted: \$10,000\.00/);
    assert.match(email.text, /Initial Payment: \$2,500\.00/);
    assert.match(email.html, /View Invoice &amp; Payment Plan|View Invoice & Payment Plan/);
    assert.match(email.html, /https:\/\/example\.test\/p\/fin-token\?item=pay-1/);
    assert.doesNotMatch(email.html, />Pay \$2,500\.00 now</);
    assert.doesNotMatch(email.html, /View your documents/i);
    assert.doesNotMatch(email.html, /#payments/);
    assert.doesNotMatch(email.html, /#documents/);
    assert.doesNotMatch(email.text, /must navigate the portal/i);
    assert.doesNotMatch(email.text, /not a request to pay/);
  });

  it("future first installment is not presented as payable now", () => {
    const email = buildInvoiceAndPaymentPlanEmail({
      clientFirstName: "Betty",
      clientEmail: "betty@example.com",
      clientName: "Betty Booked",
      venueName: "Jen's Fancy Venue",
      invoiceLabel: "Wedding invoice",
      invoiceNumber: "INV-2026-TEST",
      eventDate: "2027-10-17",
      totalContracted: 10000,
      paidToDate: 0,
      balanceDue: 10000,
      dueNow: {
        kind: "scheduled_future",
        amount: 2500,
        dueDate: "2026-12-01",
        label: "Initial Payment",
        obligationKind: "deposit",
      },
      dueDateLabel: null,
      remainingAfter: 10000,
      scheduleLines: [
        { label: "Initial Payment", amount: 2500, dueDate: "2026-12-01", status: "pending" },
      ],
      invoicePlanUrl: "https://example.test/p/fin-token",
    });
    assert.equal(email.paymentUrl, null);
    assert.match(email.text, /not due yet/);
    assert.doesNotMatch(email.html, /Pay \$2,500\.00 now/);
    assert.match(email.html, /View Invoice &amp; Payment Plan|View Invoice & Payment Plan/);
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

  it("persisted send-once gates reopen after success", () => {
    const actions = readFileSync("app/(app)/invoices/actions.ts", "utf8");
    const outbound = readFileSync("lib/invoices/outbound.ts", "utf8");
    assert.match(outbound, /hasSuccessfulPaymentRequestSend/);
    assert.match(actions, /hasSuccessfulPaymentRequestSend/);
    assert.match(actions, /INVOICE_ALREADY_SENT/);
    assert.match(actions, /already sent/i);
    const send = actions.slice(actions.indexOf("export async function sendInvoiceAndPaymentPlanAction"));
    assert.match(send, /hasSuccessfulPaymentRequestSend/);
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

describe("G. one send, branded preview, financial pay path", () => {
  const detail = readFileSync("components/invoices/invoice-detail.tsx", "utf8");
  const actions = readFileSync("app/(app)/invoices/actions.ts", "utf8");
  const outbound = readFileSync("lib/invoices/outbound.ts", "utf8");

  it("Send is the only customer outbound action", () => {
    assert.match(detail, /send-invoice-and-payment-plan/);
    assert.match(detail, /InvoicePrintDocument/);
    assert.doesNotMatch(detail, /Send copy of payment plan and invoice/);
    assert.doesNotMatch(detail, /previewInvoiceDocumentCopyAction/);
    assert.doesNotMatch(actions, /ensureCoupleDocuments/);
    assert.doesNotMatch(outbound, /createPortalSession\(clientId, "Documents", "couple"\)/);
    assert.match(outbound, /createPortalSession\(clientId, "Payment", "financial"\)/);
    assert.match(outbound, /invoicePlanUrl/);
    assert.doesNotMatch(outbound, /#payments/);
    assert.doesNotMatch(outbound, /#documents/);
  });

  it("Preview overlay is the branded document and cancel does not send", () => {
    assert.match(detail, /Customer-facing invoice and payment plan/);
    assert.match(detail, /onBack=\{\(\) => setSendOpen\(false\)\}/);
    assert.doesNotMatch(detail, /onBack=\{sendInvoiceAndPaymentPlan\}/);
    assert.doesNotMatch(detail, /Send by email/);
  });
});

describe("Edit payment plan safety", () => {
  const detail = readFileSync("components/invoices/invoice-detail.tsx", "utf8");
  const scheduleDetail = readFileSync("components/payments/payment-schedule-detail.tsx", "utf8");
  const service = readFileSync("lib/payments/service.ts", "utf8");

  it("passes invoice status into scheduleHasPaymentActivity at the invoice-detail call site", () => {
    assert.match(detail, /scheduleHasPaymentActivity\(scheduleLines, status\)/);
    assert.doesNotMatch(detail, /scheduleHasPaymentActivity\(scheduleLines\)\s*,/);
  });

  it("keeps payment-schedule-detail and replacePendingScheduleLines on the same guard", () => {
    assert.match(scheduleDetail, /scheduleHasPaymentActivity\(items, invoice\?\.status\)/);
    assert.match(service, /scheduleHasPaymentActivity\(schedule\.lineItems, invoiceStatus\)/);
    assert.match(service, /scheduleHasPaymentActivity\(schedule\.lineItems, invoice\.status\)/);
  });

  it("hides Edit behind planHasActivity and does not open the editor when locked", () => {
    assert.match(detail, /\{!planHasActivity && \(/);
    assert.match(detail, /Edit payment plan/);
    assert.match(detail, /editingPlan && !planHasActivity/);
  });

  it("locks Payments schedule line edit/add/cancel behind the same activity guard", () => {
    assert.match(scheduleDetail, /planLocked=\{planHasActivity\}/);
    assert.match(scheduleDetail, /\{!planHasActivity && \(/);
    assert.match(scheduleDetail, /Add Payment/);
    assert.match(scheduleDetail, /editMode && !planLocked/);
    assert.match(service, /assertSchedulePlanEditable/);
    assert.match(service, /export async function updateLineItem_/);
    const updateIdx = service.indexOf("export async function updateLineItem_");
    const updateSlice = service.slice(updateIdx, updateIdx + 500);
    assert.match(updateSlice, /assertSchedulePlanEditable\(scheduleId\)/);
    const addIdx = service.indexOf("export async function addLineItem(");
    assert.match(service.slice(addIdx, addIdx + 500), /assertSchedulePlanEditable\(scheduleId\)/);
    const cancelIdx = service.indexOf("export async function cancelLineItem_");
    assert.match(service.slice(cancelIdx, cancelIdx + 1600), /assertSchedulePlanEditable\(item\.schedule_id\)/);
  });
});

describe("H. customer-facing actions are Preview, Send, and Edit", () => {
  const detail = readFileSync("components/invoices/invoice-detail.tsx", "utf8");
  it("does not keep competing request/copy/preview-plan buttons", () => {
    assert.match(detail, /Preview/);
    assert.match(detail, /Open in Payments/);
    assert.match(detail, /status !== "draft" \|\| paymentRequestSent/);
    assert.match(detail, /Edit payment plan/);
    assert.match(detail, /send-invoice-and-payment-plan/);
    assert.doesNotMatch(detail, /Preview payment plan/);
    assert.doesNotMatch(detail, /View payment plan/);
    assert.doesNotMatch(detail, /Request initial payment/);
    assert.doesNotMatch(detail, /Send copy of payment plan and invoice/);
  });

  it("Preview offers Send to Client via the authoritative send-review path", () => {
    assert.match(detail, /data-testid="preview-send-invoice-and-payment-plan"/);
    assert.match(detail, /Send to Client/);
    assert.match(detail, /setPreviewOpen\(false\);\s*\n\s*openSendReview\(\)/);
    assert.match(detail, /sendInvoiceAndPaymentPlanAction/);
  });
});
