import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeActivePlanTotal,
  computeCancelledPlanAmount,
  computeInvoiceBalanceDue,
  computeNetPaid,
  deriveInvoicePaymentStatus,
} from "@/lib/payments/invoice-balance";
import { paymentPlanOverview } from "@/lib/payments/constants";
import { computePortalScheduleTotals } from "@/lib/portal/payment-totals";

const deposit = (overrides: Partial<{ status: string; paidAmount: number; refundedAmount: number }> = {}) => ({
  amount: 800,
  status: "pending",
  paidAmount: null as number | null,
  refundedAmount: null as number | null,
  ...overrides,
});

const remaining = (overrides: Partial<{ status: string; paidAmount: number; refundedAmount: number }> = {}) => ({
  amount: 2400,
  status: "pending",
  paidAmount: null as number | null,
  refundedAmount: null as number | null,
  ...overrides,
});

describe("invoice balance after payment-plan cancellation", () => {
  it("Scenario A — no cancellation: venue and portal agree", () => {
    const lines = [
      deposit({ status: "paid", paidAmount: 800 }),
      remaining(),
    ];
    assert.equal(computeNetPaid(lines), 800);
    assert.equal(computeInvoiceBalanceDue(3200, lines), 2400);
    const portal = computePortalScheduleTotals(lines);
    assert.equal(portal.planTotal, 3200);
    assert.equal(portal.paid, 800);
    assert.equal(portal.remaining, 2400);
    assert.equal(portal.remaining, computeInvoiceBalanceDue(3200, lines));
  });

  it("Scenario B — partial refund, remaining still active", () => {
    const lines = [
      deposit({ status: "partially_refunded", paidAmount: 800, refundedAmount: 100 }),
      remaining(),
    ];
    assert.equal(computeNetPaid(lines), 700);
    assert.equal(computeInvoiceBalanceDue(3200, lines), 2500);
    const portal = computePortalScheduleTotals(lines);
    assert.equal(portal.remaining, 2500);
    assert.equal(portal.remaining, computeInvoiceBalanceDue(3200, lines));
  });

  it("Scenario C — cancel remaining after deposit + $100 refund", () => {
    const lines = [
      deposit({ status: "partially_refunded", paidAmount: 800, refundedAmount: 100 }),
      remaining({ status: "cancelled" }),
    ];
    assert.equal(computeCancelledPlanAmount(lines), 2400);
    assert.equal(computeNetPaid(lines), 700);
    assert.equal(computeActivePlanTotal(lines), 800);
    assert.equal(computeInvoiceBalanceDue(3200, lines), 100);
    const portal = computePortalScheduleTotals(lines);
    assert.equal(portal.planTotal, 800);
    assert.equal(portal.paid, 700);
    assert.equal(portal.remaining, 100);
    assert.equal(portal.remaining, computeInvoiceBalanceDue(3200, lines));
    // Paid to Date must stay net paid — never total − balance_due (would be 3100).
    assert.equal(computeNetPaid(lines), 700);
    assert.notEqual(3200 - computeInvoiceBalanceDue(3200, lines), computeNetPaid(lines));
  });

  it("Scenario D — cancel remaining before any payment", () => {
    const lines = [deposit(), remaining({ status: "cancelled" })];
    assert.equal(computeInvoiceBalanceDue(3200, lines), 800);
    const portal = computePortalScheduleTotals(lines);
    assert.equal(portal.planTotal, 800);
    assert.equal(portal.remaining, 800);
    assert.equal(portal.remaining, computeInvoiceBalanceDue(3200, lines));
  });

  it("Scenario E — refund after cancellation: no double deduction", () => {
    const before = [
      deposit({ status: "paid", paidAmount: 800 }),
      remaining({ status: "cancelled" }),
    ];
    assert.equal(computeInvoiceBalanceDue(3200, before), 0);

    const afterRefund = [
      deposit({ status: "partially_refunded", paidAmount: 800, refundedAmount: 100 }),
      remaining({ status: "cancelled" }),
    ];
    assert.equal(computeNetPaid(afterRefund), 700);
    assert.equal(computeInvoiceBalanceDue(3200, afterRefund), 100);
    assert.equal(computePortalScheduleTotals(afterRefund).remaining, 100);
    // Cancelled amount counted once; refund only affects net paid.
    assert.equal(computeCancelledPlanAmount(afterRefund), 2400);
  });

  it("Scenario F — cancel one of multiple active lines", () => {
    const lines = [
      { amount: 800, status: "paid", paidAmount: 800, refundedAmount: 0 },
      { amount: 1200, status: "cancelled", paidAmount: null, refundedAmount: null },
      { amount: 1200, status: "pending", paidAmount: null, refundedAmount: null },
    ];
    assert.equal(computeCancelledPlanAmount(lines), 1200);
    assert.equal(computeActivePlanTotal(lines), 2000);
    assert.equal(computeInvoiceBalanceDue(3200, lines), 1200);
    const portal = computePortalScheduleTotals(lines);
    assert.equal(portal.planTotal, 2000);
    assert.equal(portal.remaining, 1200);
    assert.equal(portal.remaining, computeInvoiceBalanceDue(3200, lines));
  });

  it("does not subtract cancelled amounts twice from balance", () => {
    const lines = [
      deposit({ status: "paid", paidAmount: 800 }),
      remaining({ status: "cancelled" }),
    ];
    const due = computeInvoiceBalanceDue(3200, lines);
    assert.equal(due, 0);
    // Re-applying cancel math must not go negative / double-subtract.
    assert.equal(computeInvoiceBalanceDue(3200, lines), due);
  });

  it("cancelled lines stay excluded from active client plan", () => {
    const lines = [
      deposit({ status: "paid", paidAmount: 800 }),
      remaining({ status: "cancelled" }),
    ];
    const portal = computePortalScheduleTotals(lines);
    assert.equal(portal.planTotal, 800);
    assert.ok(!portal.planTotal.toString().includes("2400"));
    assert.equal(computeActivePlanTotal(lines), 800);
  });
});

describe("partial payment invoice status + plan overview", () => {
  it("$8k of $32k is Partially Paid — never Paid", () => {
    const lines = [
      { amount: 8000, status: "paid", paidAmount: 8000, refundedAmount: 0 },
      { amount: 8000, status: "pending", paidAmount: null, refundedAmount: null },
      { amount: 8000, status: "pending", paidAmount: null, refundedAmount: null },
      { amount: 8000, status: "pending", paidAmount: null, refundedAmount: null },
    ];
    const balanceDue = computeInvoiceBalanceDue(32000, lines);
    const netPaid = computeNetPaid(lines);
    assert.equal(netPaid, 8000);
    assert.equal(balanceDue, 24000);
    assert.equal(
      deriveInvoicePaymentStatus({
        balanceDue,
        netPaid,
        currentStatus: "sent",
      }),
      "partially_paid",
    );
    const overview = paymentPlanOverview({
      invoiceStatus: "partially_paid",
      items: lines.map((l) => ({
        status: l.status as "paid" | "pending",
        amount: l.amount,
        paidAmount: l.paidAmount,
      })),
    });
    assert.equal(overview.invoiceLabel, "Partially Paid");
    assert.equal(overview.paidInstallments, 1);
    assert.equal(overview.totalInstallments, 4);
    assert.equal(overview.paidAmount, 8000);
    assert.equal(overview.remainingAmount, 24000);
    assert.match(overview.summaryLine, /Partially Paid/);
    assert.match(overview.summaryLine, /1 of 4 installments paid/);
  });

  it("final payment reaches Paid with zero balance", () => {
    const lines = [
      { amount: 8000, status: "paid", paidAmount: 8000, refundedAmount: 0 },
      { amount: 8000, status: "paid", paidAmount: 8000, refundedAmount: 0 },
      { amount: 8000, status: "paid", paidAmount: 8000, refundedAmount: 0 },
      { amount: 8000, status: "paid", paidAmount: 8000, refundedAmount: 0 },
    ];
    const balanceDue = computeInvoiceBalanceDue(32000, lines);
    const netPaid = computeNetPaid(lines);
    assert.equal(balanceDue, 0);
    assert.equal(netPaid, 32000);
    assert.equal(
      deriveInvoicePaymentStatus({
        balanceDue,
        netPaid,
        currentStatus: "partially_paid",
      }),
      "paid",
    );
  });
});
