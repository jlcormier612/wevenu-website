/**
 * Pure refund-reconcile helpers — Payment net-retained matching, update body,
 * void body, deposit detection, stale SyncToken classification.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPaymentReconcileUpdateBody,
  buildPaymentVoidBody,
  computeNetRetained,
  DEPOSIT_SCAN_MAX_RESULTS,
  DEPOSIT_STATUS_UNCONFIRMED,
  depositContainsPayment,
  evaluateDepositScan,
  invoiceAppliedAmount,
  isPaymentVoided,
  isStaleSyncTokenError,
  moneyEquals,
  paymentMatchesTarget,
  type QboPayment,
} from "@/lib/quickbooks/sync/refund-reconcile";

const basePayment = (overrides: Partial<QboPayment> = {}): QboPayment => ({
  Id: "146",
  SyncToken: "0",
  TotalAmt: 600,
  UnappliedAmt: 0,
  CustomerRef: { value: "59" },
  DepositToAccountRef: { value: "4" },
  PaymentRefNum: "HTCP1D78DDDC4AE8",
  PrivateNote: "htc:payment_line_item:1b88e352-5939-48cc-9427-6fe520ae5907",
  Line: [{
    Amount: 600,
    LinkedTxn: [{ TxnId: "145", TxnType: "Invoice" }],
  }],
  ...overrides,
});

describe("computeNetRetained", () => {
  it("subtracts cumulative refunds from paid", () => {
    assert.equal(computeNetRetained(600, 0), 600);
    assert.equal(computeNetRetained(600, 100), 500);
    assert.equal(computeNetRetained(600, 200), 400);
    assert.equal(computeNetRetained(600, 600), 0);
  });

  it("never goes negative", () => {
    assert.equal(computeNetRetained(600, 700), 0);
  });
});

describe("paymentMatchesTarget — partial and full", () => {
  it("matches baseline $600 applied to invoice 145", () => {
    assert.equal(paymentMatchesTarget(basePayment(), 600, "145"), true);
  });

  it("matches a $500 partial reconciliation", () => {
    const p = basePayment({
      TotalAmt: 500,
      Line: [{ Amount: 500, LinkedTxn: [{ TxnId: "145", TxnType: "Invoice" }] }],
    });
    assert.equal(paymentMatchesTarget(p, 500, "145"), true);
    assert.equal(paymentMatchesTarget(p, 600, "145"), false);
  });

  it("rejects TotalAmt reduced without reducing the invoice line (unapplied)", () => {
    const p = basePayment({
      TotalAmt: 600,
      UnappliedAmt: 100,
      Line: [{ Amount: 500, LinkedTxn: [{ TxnId: "145", TxnType: "Invoice" }] }],
    });
    assert.equal(paymentMatchesTarget(p, 500, "145"), false);
  });

  it("matches voided / zero target", () => {
    const voided = basePayment({
      TotalAmt: 0,
      UnappliedAmt: 0,
      PrivateNote: "Voided\nhtc:payment_line_item:1b88e352-5939-48cc-9427-6fe520ae5907",
      Line: [],
    });
    assert.equal(isPaymentVoided(voided), true);
    assert.equal(paymentMatchesTarget(voided, 0, "145"), true);
    assert.equal(paymentMatchesTarget(basePayment(), 0, "145"), false);
  });
});

describe("buildPaymentReconcileUpdateBody", () => {
  it("preserves deposit account, token, note, and invoice link while reducing amount", () => {
    const body = buildPaymentReconcileUpdateBody(basePayment(), 500, "145");
    assert.equal(body.Id, "146");
    assert.equal(body.SyncToken, "0");
    assert.equal(body.TotalAmt, 500);
    assert.deepEqual(body.CustomerRef, { value: "59" });
    assert.deepEqual(body.DepositToAccountRef, { value: "4" });
    assert.equal(body.PaymentRefNum, "HTCP1D78DDDC4AE8");
    assert.equal(body.PrivateNote, "htc:payment_line_item:1b88e352-5939-48cc-9427-6fe520ae5907");
    assert.deepEqual(body.Line, [{
      Amount: 500,
      LinkedTxn: [{ TxnId: "145", TxnType: "Invoice" }],
    }]);
    assert.equal(body.sparse, false);
  });

  it("void body is sparse Id + SyncToken only", () => {
    assert.deepEqual(buildPaymentVoidBody(basePayment({ SyncToken: "3" })), {
      Id: "146",
      SyncToken: "3",
      sparse: true,
    });
  });
});

describe("depositContainsPayment", () => {
  it("detects a Payment LinkedTxn inside Deposit lines", () => {
    assert.equal(
      depositContainsPayment([{
        Id: "9",
        Line: [{ LinkedTxn: [{ TxnId: "146", TxnType: "Payment" }] }],
      }], "146"),
      true,
    );
    assert.equal(
      depositContainsPayment([{
        Id: "9",
        Line: [{ LinkedTxn: [{ TxnId: "99", TxnType: "Payment" }] }],
      }], "146"),
      false,
    );
  });
});

describe("evaluateDepositScan — fail closed", () => {
  it("permits a clean miss when the page is incomplete (under the cap)", () => {
    const deposits = Array.from({ length: 3 }, (_, i) => ({
      Id: String(i),
      Line: [{ LinkedTxn: [{ TxnId: "999", TxnType: "Payment" }] }],
    }));
    assert.equal(evaluateDepositScan(deposits, "146"), "clear");
    assert.ok(deposits.length < DEPOSIT_SCAN_MAX_RESULTS);
  });

  it("treats a full 100-row page without the Payment as ambiguous", () => {
    const deposits = Array.from({ length: DEPOSIT_SCAN_MAX_RESULTS }, (_, i) => ({
      Id: String(i),
      Line: [{ LinkedTxn: [{ TxnId: "x", TxnType: "Payment" }] }],
    }));
    assert.equal(evaluateDepositScan(deposits, "146"), "ambiguous");
  });

  it("reports found when the Payment is linked from any Deposit", () => {
    assert.equal(
      evaluateDepositScan([{
        Id: "1",
        Line: [{ LinkedTxn: [{ TxnId: "146", TxnType: "Payment" }] }],
      }], "146"),
      "found",
    );
  });

  it("treats a malformed non-array payload as ambiguous", () => {
    assert.equal(evaluateDepositScan({ not: "an array" }, "146"), "ambiguous");
  });

  it("treats null or undefined as ambiguous (not a proven empty scan)", () => {
    assert.equal(evaluateDepositScan(null, "146"), "ambiguous");
    assert.equal(evaluateDepositScan(undefined, "146"), "ambiguous");
  });

  it("treats an explicit empty array as a clean empty result", () => {
    assert.equal(evaluateDepositScan([], "146"), "clear");
  });

  it("exports the refuse-to-write status copy for the sync gate", () => {
    assert.match(DEPOSIT_STATUS_UNCONFIRMED, /Could not confirm Bank Deposit status/);
    assert.match(DEPOSIT_STATUS_UNCONFIRMED, /no QuickBooks write was attempted/);
  });
});

describe("isStaleSyncTokenError", () => {
  it("recognizes Intuit stale-object / 5010 wording", () => {
    assert.equal(isStaleSyncTokenError('Stale Object Error: SyncToken'), true);
    assert.equal(isStaleSyncTokenError('{"code":"5010"}'), true);
    assert.equal(isStaleSyncTokenError("ValidationFault deposit required"), false);
  });
});

describe("invoiceAppliedAmount", () => {
  it("sums only Invoice-linked lines", () => {
    assert.ok(moneyEquals(invoiceAppliedAmount(basePayment(), "145"), 600));
    assert.equal(invoiceAppliedAmount(basePayment(), "999"), 0);
  });
});
