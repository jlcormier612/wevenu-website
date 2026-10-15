/**
 * Overview “Record deposit received” must open the shared payment-entry dialog
 * and must not silently create a payment on click.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const panel = readFileSync(
  resolve("components/booking-journey/booking-journey-panel.tsx"),
  "utf8",
);
const facts = readFileSync(
  resolve("components/booking-journey/commercial-facts.tsx"),
  "utf8",
);
const actions = readFileSync(
  resolve("app/(app)/booking-journey/payments-actions.ts"),
  "utf8",
);
const invoiceDetail = readFileSync(
  resolve("components/invoices/invoice-detail.tsx"),
  "utf8",
);
const scheduleDetail = readFileSync(
  resolve("components/payments/payment-schedule-detail.tsx"),
  "utf8",
);
const dialog = readFileSync(
  resolve("components/invoices/record-offline-payment-dialog.tsx"),
  "utf8",
);

describe("Overview Record deposit received opens shared form", () => {
  it("button wires to onRecordDeposit and does not call a server action inline", () => {
    assert.match(facts, /Record deposit received/);
    assert.match(facts, /onClick=\{onRecordDeposit\}/);
    assert.doesNotMatch(facts, /recordDepositReceivedAction/);
  });

  it("panel opens RecordOfflinePaymentDialog instead of one-click record", () => {
    assert.match(panel, /RecordOfflinePaymentDialog/);
    assert.match(panel, /setRecordDepositOpen\(true\)/);
    assert.doesNotMatch(
      panel,
      /recordDepositReceivedAction\(\s*\{\s*clientId/,
    );
    assert.match(panel, /acceptedMethods=\{journey\.prefs\.acceptedPaymentMethods\}/);
  });

  it("legacy recordDepositReceivedAction refuses silent recording", () => {
    const fn = actions.slice(actions.indexOf("export async function recordDepositReceivedAction"));
    assert.match(fn, /ok: false/);
    assert.match(fn, /Choose the installment, amount, method, and date/);
    assert.doesNotMatch(fn, /markLineItemPaid/);
  });

  it("shared dialog requires explicit confirm and supports cancel with no submit", () => {
    assert.match(dialog, /async function submit/);
    assert.match(dialog, /idempotencyKey/);
    assert.match(dialog, /submitLock/);
    assert.match(dialog, /onOpenChange\(false\)/);
    assert.match(dialog, /Record payment received/);
    assert.match(dialog, /Cancel/);
  });
});

describe("All payment-recording entry points use deliberate form", () => {
  it("invoice and schedule surfaces use form UX; no Overview one-click remains", () => {
    assert.match(invoiceDetail, /RecordOfflinePaymentDialog/);
    assert.match(invoiceDetail, /setRecordPaymentOpen\(true\)/);
    assert.doesNotMatch(invoiceDetail, /recordInvoiceInstallmentReceivedAction/);
    assert.match(scheduleDetail, /Record payment received/);
    assert.match(scheduleDetail, /Amount received/);
    assert.match(scheduleDetail, /Payment method/);
    assert.match(scheduleDetail, /Date received/);
    assert.match(scheduleDetail, /idempotencyKey/);
  });
});
