import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveAmountDueNow, pickNextOpenPaymentLine } from "@/lib/invoices/amount-due-now";

describe("resolveAmountDueNow", () => {
  it("uses the next open installment, not the full balance", () => {
    const r = resolveAmountDueNow({
      balanceDue: 3200,
      scheduleLines: [
        { amount: 800, dueDate: "2026-09-08", status: "pending", label: "Deposit" },
        { amount: 2400, dueDate: "2026-10-17", status: "pending", label: "Remaining balance" },
      ],
    });
    assert.equal(r.kind, "next_installment");
    if (r.kind !== "next_installment") return;
    assert.equal(r.amount, 800);
    assert.equal(r.label, "Deposit");
  });

  it("does not label full balance as due now when there is no schedule", () => {
    const r = resolveAmountDueNow({ balanceDue: 3200, scheduleLines: null });
    assert.equal(r.kind, "balance_only");
    if (r.kind !== "balance_only") return;
    assert.equal(r.reason, "no_schedule");
  });

  it("is paid in full when balance is zero", () => {
    assert.equal(resolveAmountDueNow({ balanceDue: 0, scheduleLines: [] }).kind, "paid_in_full");
  });

  it("picks earliest due open line", () => {
    const next = pickNextOpenPaymentLine([
      { amount: 2400, dueDate: "2026-10-17", status: "pending", label: "Remaining" },
      { amount: 800, dueDate: "2026-09-01", status: "overdue", label: "Deposit" },
    ]);
    assert.equal(next?.amount, 800);
  });
});
