import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { scheduleRowPrimaryAmount } from "@/lib/portal/payment-schedule-row-amount";
import { computePortalScheduleTotals } from "@/lib/portal/payment-totals";

/**
 * Regression for Production Batch 2 defect: unpaid installment with
 * paidAmount=0 must not render $0 on the schedule row while summary
 * Remaining shows the scheduled amount.
 */
describe("scheduleRowPrimaryAmount — portal Payment Schedule row", () => {
  it("unpaid installment with paidAmount=0 shows scheduled amount (Batch 2 defect)", () => {
    assert.equal(
      scheduleRowPrimaryAmount({
        amount: 4000,
        paidAmount: 0,
        status: "pending",
      }),
      4000,
    );
  });

  it("unpaid installment with null paidAmount shows scheduled amount", () => {
    assert.equal(
      scheduleRowPrimaryAmount({
        amount: 4000,
        paidAmount: null,
        status: "pending",
      }),
      4000,
    );
  });

  it("unpaid installment with absent paidAmount shows scheduled amount", () => {
    assert.equal(
      scheduleRowPrimaryAmount({
        amount: 2500,
        status: "overdue",
      }),
      2500,
    );
  });

  it("fully paid installment shows scheduled amount (not a substituted collection)", () => {
    assert.equal(
      scheduleRowPrimaryAmount({
        amount: 1000,
        paidAmount: 1000,
        status: "paid",
      }),
      1000,
    );
  });

  it("partially paid installment still shows scheduled installment amount", () => {
    assert.equal(
      scheduleRowPrimaryAmount({
        amount: 8000,
        paidAmount: 3000,
        status: "partially_paid",
      }),
      8000,
    );
  });

  it("legitimate zero-dollar installment displays 0", () => {
    assert.equal(
      scheduleRowPrimaryAmount({
        amount: 0,
        paidAmount: 0,
        status: "pending",
      }),
      0,
    );
  });

  it("processing / refunded statuses still use scheduled amount", () => {
    assert.equal(
      scheduleRowPrimaryAmount({ amount: 500, paidAmount: 0, status: "processing" }),
      500,
    );
    assert.equal(
      scheduleRowPrimaryAmount({ amount: 500, paidAmount: 500, status: "refunded" }),
      500,
    );
  });

  it("does not reproduce the paidAmount ?? amount bug for unpaid zero collections", () => {
    const line = { amount: 4000, paidAmount: 0 as number | null, status: "pending" };
    const buggy = line.paidAmount ?? line.amount;
    const fixed = scheduleRowPrimaryAmount(line);
    assert.equal(buggy, 0);
    assert.equal(fixed, 4000);
  });
});

describe("schedule row + summary totals stay consistent (Batch 2 fixture shape)", () => {
  const lines = [
    { amount: 1000, status: "paid", paidAmount: 1000 },
    { amount: 4000, status: "pending", paidAmount: 0 },
  ];

  it("summary math: Total 5000 / Paid 1000 / Remaining 4000", () => {
    const t = computePortalScheduleTotals(lines);
    assert.equal(t.planTotal, 5000);
    assert.equal(t.paid, 1000);
    assert.equal(t.remaining, 4000);
  });

  it("each row primary amount matches scheduled installment", () => {
    assert.deepEqual(
      lines.map((l) => scheduleRowPrimaryAmount(l)),
      [1000, 4000],
    );
  });

  it("partial + unpaid multi-installment: row amounts unchanged; paid/remaining reflect collection", () => {
    const multi = [
      { amount: 2000, status: "partially_paid", paidAmount: 750 },
      { amount: 3000, status: "pending", paidAmount: 0 },
      { amount: 0, status: "pending", paidAmount: 0 },
    ];
    const t = computePortalScheduleTotals(multi);
    assert.equal(t.planTotal, 5000);
    assert.equal(t.paid, 750);
    assert.equal(t.remaining, 4250);
    assert.deepEqual(
      multi.map((l) => scheduleRowPrimaryAmount(l)),
      [2000, 3000, 0],
    );
  });
});
