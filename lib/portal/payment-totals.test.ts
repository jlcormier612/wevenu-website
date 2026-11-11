import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computePortalScheduleTotals } from "@/lib/portal/payment-totals";
import { remainingBalanceFromSchedules } from "@/lib/portal/payment-schedules";
import { settledPaidTotal } from "@/lib/portal/checkout-return-notice";

describe("computePortalScheduleTotals — refund-net + cancelled", () => {
  it("matches venue refund-net paid and remaining", () => {
    const t = computePortalScheduleTotals([
      { amount: 800, status: "partially_refunded", paidAmount: 800, refundedAmount: 100 },
      { amount: 2400, status: "pending", paidAmount: null, refundedAmount: 0 },
    ]);
    assert.equal(t.planTotal, 3200);
    assert.equal(t.paid, 700);
    assert.equal(t.remaining, 2500);
  });

  it("excludes cancelled lines from plan total and remaining", () => {
    const t = computePortalScheduleTotals([
      { amount: 800, status: "cancelled", paidAmount: null, refundedAmount: 0 },
      { amount: 2400, status: "pending", paidAmount: null, refundedAmount: 0 },
    ]);
    assert.equal(t.planTotal, 2400);
    assert.equal(t.paid, 0);
    assert.equal(t.remaining, 2400);
  });

  it("treats a full refund as zero retained and still on plan until cancelled", () => {
    const t = computePortalScheduleTotals([
      { amount: 800, status: "refunded", paidAmount: 800, refundedAmount: 800 },
      { amount: 2400, status: "pending" },
    ]);
    assert.equal(t.paid, 0);
    assert.equal(t.remaining, 3200);
  });

  it("counts partially_paid collections toward paid", () => {
    const t = computePortalScheduleTotals([
      { amount: 8750, status: "partially_paid", paidAmount: 4000 },
      { amount: 26250, status: "pending" },
    ]);
    assert.equal(t.paid, 4000);
    assert.equal(t.remaining, 31000);
  });

  it("does not treat pending deposit as paid", () => {
    const t = computePortalScheduleTotals([
      { amount: 8750, status: "pending", paidAmount: 0 },
      { amount: 26250, status: "pending", paidAmount: 0 },
    ]);
    assert.equal(t.paid, 0);
    assert.equal(t.remaining, 35000);
  });
});

describe("remainingBalanceFromSchedules", () => {
  it("does not count refunded or cancelled amounts as still owed incorrectly", () => {
    const remaining = remainingBalanceFromSchedules([
      {
        id: "s1",
        title: "Plan",
        invoiceId: "inv-1",
        totalAmount: 3200,
        lineItems: [
          { id: "a", label: "Deposit", amount: 800, dueDate: null, status: "paid", paidAmount: 800, refundedAmount: 0 },
          { id: "b", label: "Remaining", amount: 2400, dueDate: null, status: "pending" },
        ],
      },
    ]);
    assert.equal(remaining, 2400);
  });

  it("after partial refund increases remaining by refunded amount", () => {
    const remaining = remainingBalanceFromSchedules([
      {
        id: "s1",
        title: "Plan",
        invoiceId: "inv-1",
        totalAmount: 3200,
        lineItems: [
          {
            id: "a",
            label: "Deposit",
            amount: 800,
            dueDate: null,
            status: "partially_refunded",
            paidAmount: 800,
            refundedAmount: 200,
          },
          { id: "b", label: "Remaining", amount: 2400, dueDate: null, status: "pending" },
        ],
      },
    ]);
    assert.equal(remaining, 2600);
  });
});

describe("settledPaidTotal refund-net", () => {
  it("subtracts refundedAmount", () => {
    assert.equal(
      settledPaidTotal([
        { id: "a", status: "partially_refunded", amount: 800, paidAmount: 800, refundedAmount: 100 },
      ]),
      700,
    );
  });
});
