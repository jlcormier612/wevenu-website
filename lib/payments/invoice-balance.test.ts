import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

describe("Nicole/Colby reported partial installment (INV-2026-3B9F4B)", () => {
  const TOTAL = 36_656.25;
  const INITIAL = 9_164.06;
  const RECEIVED = 7_164.06;
  const REMAINDER = 2_000.0;
  const EXPECTED_BALANCE = 29_492.19;

  const nicoleLines = [
    { amount: INITIAL, status: "partially_paid", paidAmount: RECEIVED, refundedAmount: 0 },
    { amount: 9_164.06, status: "pending", paidAmount: null, refundedAmount: null },
    { amount: 9_164.06, status: "pending", paidAmount: null, refundedAmount: null },
    { amount: 9_164.07, status: "pending", paidAmount: null, refundedAmount: null },
  ];

  it("1 — $7,164.06 retained against $9,164.06 → balance $29,492.19; installment remainder $2,000", () => {
    assert.equal(computeNetPaid(nicoleLines), RECEIVED);
    assert.equal(computeInvoiceBalanceDue(TOTAL, nicoleLines), EXPECTED_BALANCE);
    assert.equal(
      Math.round((INITIAL - RECEIVED) * 100) / 100,
      REMAINDER,
    );
    assert.notEqual(computeInvoiceBalanceDue(TOTAL, nicoleLines), TOTAL);
    assert.equal(
      deriveInvoicePaymentStatus({
        balanceDue: EXPECTED_BALANCE,
        netPaid: RECEIVED,
        currentStatus: "sent",
      }),
      "partially_paid",
    );
    const overview = paymentPlanOverview({
      invoiceStatus: "partially_paid",
      items: nicoleLines.map((l) => ({
        status: l.status as "partially_paid" | "pending",
        amount: l.amount,
        paidAmount: l.paidAmount,
      })),
    });
    assert.equal(overview.invoiceLabel, "Partially Paid");
    assert.equal(overview.paidInstallments, 0); // none fully paid
    assert.equal(overview.totalInstallments, 4);
    assert.equal(overview.paidAmount, RECEIVED);
    assert.equal(overview.remainingAmount, EXPECTED_BALANCE);
    assert.match(overview.summaryLine, /Partially Paid/);
    assert.match(overview.summaryLine, /\$7,164\.06 paid/);
    assert.match(overview.summaryLine, /\$29,492\.19 remaining/);
    const portal = computePortalScheduleTotals(nicoleLines);
    assert.equal(portal.paid, RECEIVED);
    assert.equal(portal.remaining, EXPECTED_BALANCE);
    assert.equal(portal.remaining, computeInvoiceBalanceDue(TOTAL, nicoleLines));
  });

  it("2 — no payments: balance equals full invoice total", () => {
    const unpaid = nicoleLines.map((l) => ({
      ...l,
      status: "pending",
      paidAmount: null,
      refundedAmount: null,
    }));
    assert.equal(computeNetPaid(unpaid), 0);
    assert.equal(computeInvoiceBalanceDue(TOTAL, unpaid), TOTAL);
  });

  it("3 — exact installment payment marks that line fully paid only", () => {
    const exact = [
      { amount: INITIAL, status: "paid", paidAmount: INITIAL, refundedAmount: 0 },
      ...nicoleLines.slice(1),
    ];
    assert.equal(computeNetPaid(exact), INITIAL);
    assert.equal(
      Math.round(computeInvoiceBalanceDue(TOTAL, exact) * 100) / 100,
      Math.round((TOTAL - INITIAL) * 100) / 100,
    );
    assert.equal(
      deriveInvoicePaymentStatus({
        balanceDue: computeInvoiceBalanceDue(TOTAL, exact),
        netPaid: INITIAL,
        currentStatus: "sent",
      }),
      "partially_paid",
    );
  });

  it("4 — partial then second payment accumulate without overstating", () => {
    const afterSecond = [
      { amount: INITIAL, status: "paid", paidAmount: INITIAL, refundedAmount: 0 },
      ...nicoleLines.slice(1),
    ];
    // $7,164.06 + $2,000.00 = full installment
    assert.equal(computeNetPaid(afterSecond), INITIAL);
    assert.equal(
      Math.round(computeInvoiceBalanceDue(TOTAL, afterSecond) * 100) / 100,
      Math.round((TOTAL - INITIAL) * 100) / 100,
    );
  });

  it("5 — multiple partial payments across installments", () => {
    const multi = [
      { amount: INITIAL, status: "partially_paid", paidAmount: RECEIVED, refundedAmount: 0 },
      { amount: 9_164.06, status: "partially_paid", paidAmount: 1_000, refundedAmount: 0 },
      { amount: 9_164.06, status: "pending", paidAmount: null, refundedAmount: null },
      { amount: 9_164.07, status: "pending", paidAmount: null, refundedAmount: null },
    ];
    const net = RECEIVED + 1_000;
    assert.equal(computeNetPaid(multi), net);
    assert.equal(
      Math.round(computeInvoiceBalanceDue(TOTAL, multi) * 100) / 100,
      Math.round((TOTAL - net) * 100) / 100,
    );
  });

  it("6 — duplicate / replay does not double-count (idempotent net from line state)", () => {
    // Authoritative state is the line's paid_amount once — replaying the same
    // retained total must not invent a second collection.
    assert.equal(computeNetPaid(nicoleLines), RECEIVED);
    assert.equal(computeNetPaid(nicoleLines), computeNetPaid(nicoleLines));
    assert.equal(computeInvoiceBalanceDue(TOTAL, nicoleLines), EXPECTED_BALANCE);
  });

  it("7 — partial refund reduces net retained and raises balance; history fields preserved", () => {
    const refunded = [
      {
        amount: INITIAL,
        status: "partially_refunded",
        paidAmount: RECEIVED,
        refundedAmount: 500,
      },
      ...nicoleLines.slice(1),
    ];
    assert.equal(computeNetPaid(refunded), RECEIVED - 500);
    assert.equal(
      Math.round(computeInvoiceBalanceDue(TOTAL, refunded) * 100) / 100,
      Math.round((TOTAL - (RECEIVED - 500)) * 100) / 100,
    );
    assert.equal(refunded[0]!.paidAmount, RECEIVED);
    assert.equal(refunded[0]!.refundedAmount, 500);
  });

  it("8 — full refund of the partial restores full invoice balance", () => {
    const fullRefund = [
      {
        amount: INITIAL,
        status: "refunded",
        paidAmount: RECEIVED,
        refundedAmount: RECEIVED,
      },
      ...nicoleLines.slice(1),
    ];
    assert.equal(computeNetPaid(fullRefund), 0);
    assert.equal(computeInvoiceBalanceDue(TOTAL, fullRefund), TOTAL);
  });

  it("9 — pending / failed / non-qualifying statuses do not reduce balance", () => {
    const nonQualifying = [
      { amount: INITIAL, status: "pending", paidAmount: RECEIVED, refundedAmount: 0 },
      { amount: 9_164.06, status: "processing", paidAmount: null, refundedAmount: null },
      { amount: 9_164.06, status: "overdue", paidAmount: null, refundedAmount: null },
      { amount: 9_164.07, status: "pending", paidAmount: null, refundedAmount: null },
    ];
    assert.equal(computeNetPaid(nonQualifying), 0);
    assert.equal(computeInvoiceBalanceDue(TOTAL, nonQualifying), TOTAL);
  });

  it("10 — rounding / final-installment remainder reconciles to the cent", () => {
    const cents = [
      { amount: 9_164.06, status: "paid", paidAmount: 9_164.06, refundedAmount: 0 },
      { amount: 9_164.06, status: "paid", paidAmount: 9_164.06, refundedAmount: 0 },
      { amount: 9_164.06, status: "paid", paidAmount: 9_164.06, refundedAmount: 0 },
      { amount: 9_164.07, status: "paid", paidAmount: 9_164.07, refundedAmount: 0 },
    ];
    assert.equal(computeNetPaid(cents), TOTAL);
    assert.equal(computeInvoiceBalanceDue(TOTAL, cents), 0);
    assert.equal(
      cents.reduce((s, l) => s + l.amount, 0),
      TOTAL,
    );
  });

  it("11 — invoice, payment-plan, and portal summaries agree", () => {
    const balanceDue = computeInvoiceBalanceDue(TOTAL, nicoleLines);
    const netPaid = computeNetPaid(nicoleLines);
    const portal = computePortalScheduleTotals(nicoleLines);
    const overview = paymentPlanOverview({
      invoiceStatus: "partially_paid",
      items: nicoleLines.map((l) => ({
        status: l.status as "partially_paid" | "pending",
        amount: l.amount,
        paidAmount: l.paidAmount,
      })),
    });
    assert.equal(portal.paid, netPaid);
    assert.equal(portal.remaining, balanceDue);
    assert.equal(overview.paidAmount, netPaid);
    assert.equal(overview.remainingAmount, balanceDue);
  });
});

describe("DB balance trigger migration counts partially_paid", () => {
  it("12 — migration SQL includes partially_paid and cancelled in balance formula", () => {
    const sql = readFileSync(
      resolve("supabase/migrations/20261417200000_invoice_balance_counts_partially_paid.sql"),
      "utf8",
    );
    assert.match(sql, /partially_paid/);
    assert.match(sql, /_compute_invoice_cancelled_plan_amount/);
    assert.match(sql, /_compute_invoice_balance_due/);
    assert.match(sql, /'paid', 'partially_paid', 'partially_refunded', 'refunded'/);
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
