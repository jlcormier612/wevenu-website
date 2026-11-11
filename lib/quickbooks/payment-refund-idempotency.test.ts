/**
 * Payment create idempotency + invoice-linked refund Payment reconciliation.
 *
 * Payment create still recovers via PaymentRefNum (PrivateNote is not
 * queryable — ValidationFault 4001). Refunds no longer create RefundReceipt;
 * they GET/update/void the existing Payment to match net retained collections.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  paymentCorrelationToken,
  refundCorrelationToken,
} from "@/lib/quickbooks/sync/correlation-token";

const payment = readFileSync(resolve("lib/quickbooks/sync/payment.ts"), "utf8");
const refund = readFileSync(resolve("lib/quickbooks/sync/refund.ts"), "utf8");
const processor = readFileSync(resolve("lib/quickbooks/processor.ts"), "utf8");
const tokenSource = readFileSync(resolve("lib/quickbooks/sync/correlation-token.ts"), "utf8");
const paymentsService = readFileSync(resolve("lib/payments/service.ts"), "utf8");
const paymentsRepo = readFileSync(resolve("lib/payments/repository.ts"), "utf8");

const SAMPLE_LINE_ID = "1b88e352-5939-48cc-9427-6fe520ae5907";

describe("correlation tokens", () => {
  it("are deterministic for the same row id", () => {
    assert.equal(paymentCorrelationToken(SAMPLE_LINE_ID), paymentCorrelationToken(SAMPLE_LINE_ID));
    assert.equal(refundCorrelationToken(SAMPLE_LINE_ID), refundCorrelationToken(SAMPLE_LINE_ID));
  });

  it("differ between payment and refund of the same row", () => {
    assert.notEqual(paymentCorrelationToken(SAMPLE_LINE_ID), refundCorrelationToken(SAMPLE_LINE_ID));
  });

  it("stay under the 21-character QuickBooks field limit", () => {
    assert.ok(paymentCorrelationToken(SAMPLE_LINE_ID).length <= 21);
    assert.ok(refundCorrelationToken(SAMPLE_LINE_ID).length <= 21);
  });

  it("are not GUID-shaped (no dashes) so the query parser accepts them", () => {
    assert.doesNotMatch(paymentCorrelationToken(SAMPLE_LINE_ID), /-/);
    assert.match(paymentCorrelationToken(SAMPLE_LINE_ID), /^HTCP[0-9A-F]{12}$/);
    assert.match(refundCorrelationToken(SAMPLE_LINE_ID), /^HTCR[0-9A-F]{12}$/);
  });

  it("derive from sha256 of the row id, not a truncated UUID", () => {
    const expected =
      "HTCP" + createHash("sha256").update(SAMPLE_LINE_ID).digest("hex").slice(0, 12).toUpperCase();
    assert.equal(paymentCorrelationToken(SAMPLE_LINE_ID), expected);
  });
});

describe("payment create cached-id short-circuit", () => {
  it("returns the stored payment id without calling quickBooksFetch", () => {
    const body = payment.slice(payment.indexOf("export async function syncPayment"));
    const cachedAt = body.indexOf("if (itemRow.quickbooks_payment_id)");
    const fetchAt = body.indexOf("await quickBooksFetch");
    assert.ok(cachedAt >= 0 && cachedAt < fetchAt);
    assert.match(body, /quickbooksId: itemRow\.quickbooks_payment_id/);
  });
});

describe("refund reconcile — invoice-linked Payment path", () => {
  it("does not create RefundReceipt or query DocNumber", () => {
    assert.doesNotMatch(refund, /\/refundreceipt/i);
    assert.doesNotMatch(refund, /select \* from RefundReceipt/);
    assert.doesNotMatch(refund, /DocNumber:/);
    assert.doesNotMatch(refund, /refundCorrelationToken/);
    assert.doesNotMatch(refund, /htc:payment_refund:/);
  });

  it("reads the latest ledger amounts and computes net retained", () => {
    assert.match(refund, /paid_amount, refunded_amount/);
    assert.match(refund, /computeNetRetained/);
    assert.match(refund, /quickbooks_refund_net_synced/);
  });

  it("requires an existing quickbooks_payment_id (unsupported otherwise)", () => {
    assert.match(refund, /has not been synced to QuickBooks yet/);
    assert.match(refund, /retryable: false/);
  });

  it("GETs the remote Payment before any update or void", () => {
    const getAt = refund.indexOf("/payment/${encodeURIComponent(paymentId)}");
    const updateAt = refund.indexOf('"/payment"');
    const voidAt = refund.indexOf("operation=update&include=void");
    assert.ok(getAt >= 0, "must GET /payment/{id}");
    assert.ok(updateAt > getAt, "update must follow GET");
    assert.ok(voidAt > getAt, "void must follow GET");
  });

  it("adopts when remote already matches the target", () => {
    assert.match(refund, /paymentMatchesTarget/);
    assert.match(refund, /return success\(/);
  });

  it("runs the deposit-safety gate before both update and void mutations", () => {
    const gateAt = refund.indexOf("assertPaymentNotInBankDeposit");
    const voidAt = refund.indexOf("operation=update&include=void");
    const updateAt = refund.indexOf('"/payment"');
    assert.ok(gateAt >= 0, "must call assertPaymentNotInBankDeposit");
    assert.ok(voidAt > gateAt, "void must follow the deposit gate");
    assert.ok(updateAt > gateAt, "update must follow the deposit gate");
    // One shared gate at the top of applyReconcileWrite serves both paths.
    const apply = refund.slice(refund.indexOf("async function applyReconcileWrite"));
    assert.match(apply, /assertPaymentNotInBankDeposit/);
    assert.equal((apply.match(/assertPaymentNotInBankDeposit/g) ?? []).length, 1);
  });

  it("fails closed on capped or ambiguous Deposit scans", () => {
    assert.match(refund, /evaluateDepositScan/);
    assert.match(refund, /DEPOSIT_STATUS_UNCONFIRMED|Could not confirm Bank Deposit status/);
    assert.match(refund, /included in a Bank Deposit/);
  });

  it("normalizes an omitted Deposit field to [] after validating QueryResponse", () => {
    assert.match(refund, /QueryResponse\.Deposit \?\? \[\]/);
  });

  it("uses a full Payment update body for partial targets", () => {
    assert.match(refund, /buildPaymentReconcileUpdateBody/);
  });

  it("handles stale SyncToken with one re-read before a conditional retry", () => {
    assert.match(refund, /isStaleSyncTokenError/);
    assert.match(refund, /secondRead/);
  });

  it("forwards uncertain write outcomes without inventing a second mutation path", () => {
    assert.match(refund, /uncertain:\s*voidResult\.uncertain|uncertain:\s*updateResult\.uncertain/);
  });

  it("cache short-circuit compares net-synced to current target, not a prior refund id", () => {
    assert.match(refund, /quickbooks_refund_net_synced != null/);
    assert.doesNotMatch(refund, /quickbooks_refund_id/);
  });
});

describe("processor persists refund net-synced cache", () => {
  it("writes quickbooks_refund_net_synced on refund success", () => {
    assert.match(processor, /quickbooks_refund_net_synced/);
    assert.match(processor, /refundNetSynced/);
  });
});

describe("payment create still uses PaymentRefNum recovery", () => {
  it("payment recovers on PaymentRefNum, never PrivateNote", () => {
    assert.match(payment, /select \* from Payment where PaymentRefNum = '/);
    assert.doesNotMatch(payment, /where PrivateNote/);
  });

  it("payment create sets PaymentRefNum from the token helper and keeps PrivateNote", () => {
    assert.match(payment, /PaymentRefNum:\s*correlationToken/);
    assert.match(payment, /PrivateNote:\s*privateNote/);
    assert.match(payment, /htc:payment_line_item:/);
  });

  it("PrivateNote is never used as a query filter on payment", () => {
    assert.doesNotMatch(payment, /where\s+PrivateNote/i);
    assert.doesNotMatch(payment, /PrivateNote\s*=\s*'/);
  });

  it("payment forwards createResult.uncertain", () => {
    assert.match(payment, /uncertain:\s*createResult\.uncertain/);
  });
});

describe("ledger concurrent-refund protection and Stripe/Owner unchanged", () => {
  it("refundLineItem conditions the update on the prior refunded_amount", () => {
    const fn = paymentsRepo.slice(paymentsRepo.indexOf("export async function refundLineItem"));
    assert.match(fn, /refunded_amount\.is\.null,refunded_amount\.eq\.0|eq\("refunded_amount", alreadyRefunded\)/);
    assert.match(fn, /updated by someone else/);
  });

  it("enqueue payload carries cumulative refundedAmount and paidAmount", () => {
    const fn = paymentsService.slice(paymentsService.indexOf("export async function refundLineItem_"));
    assert.match(fn, /refundedAmount:\s*outcome\.newRefundedTotal/);
    assert.match(fn, /paidAmount:\s*outcome\.paidAmount/);
  });

  it("Stripe refund still runs before the ledger mutation when a PI exists", () => {
    const fn = paymentsService.slice(paymentsService.indexOf("export async function refundLineItem_"));
    const stripeAt = fn.indexOf("refundStripePayment");
    const ledgerAt = fn.indexOf("repo.refundLineItem");
    assert.ok(stripeAt >= 0 && ledgerAt > stripeAt);
  });

  it("Owner-only capability gate remains on refundLineItem_", () => {
    const fn = paymentsService.slice(paymentsService.indexOf("export async function refundLineItem_"));
    assert.match(fn, /payments\.refund/);
    assert.match(fn, /requireCapability/);
  });
});

describe("token module stays write-incapable", () => {
  it("never calls QuickBooks or touches the database", () => {
    assert.doesNotMatch(tokenSource, /quickBooksFetch/);
    assert.doesNotMatch(tokenSource, /createAdminClient|\.from\(/);
    assert.doesNotMatch(tokenSource, /method:\s*"POST"/);
  });
});
