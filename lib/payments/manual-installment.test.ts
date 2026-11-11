import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { selectCurrentUnpaidInstallment } from "@/lib/payments/manual-installment";

describe("manual installment selection", () => {
  it("prefers the earliest overdue line", () => {
    const picked = selectCurrentUnpaidInstallment([
      { id: "later", status: "overdue", dueDate: "2026-10-10", amount: 100 },
      { id: "sooner", status: "overdue", dueDate: "2026-10-01", amount: 50 },
      { id: "pend", status: "pending", dueDate: "2026-09-01", amount: 10 },
    ]);
    assert.equal(picked?.id, "sooner");
  });

  it("falls back to the next pending line when nothing is overdue", () => {
    const picked = selectCurrentUnpaidInstallment([
      { id: "b", status: "pending", dueDate: "2026-12-01", amount: 20 },
      { id: "a", status: "pending", dueDate: "2026-11-01", amount: 20 },
      { id: "paid", status: "paid", dueDate: "2026-01-01", amount: 20 },
    ]);
    assert.equal(picked?.id, "a");
  });

  it("does not treat a Stripe in-flight line as a manual receipt", () => {
    const picked = selectCurrentUnpaidInstallment([
      {
        id: "ach",
        status: "pending",
        dueDate: "2026-10-01",
        amount: 40,
        stripePaymentIntentId: "pi_123",
      },
      { id: "cash", status: "overdue", dueDate: "2026-10-02", amount: 40 },
    ]);
    assert.equal(picked?.id, "cash");
  });

  it("returns null when every line is already paid or online", () => {
    assert.equal(
      selectCurrentUnpaidInstallment([
        { id: "p", status: "paid", dueDate: "2026-01-01", amount: 1 },
      ]),
      null,
    );
  });

  it("prefers a partially paid installment over the next pending line", () => {
    const picked = selectCurrentUnpaidInstallment([
      { id: "partial", status: "partially_paid", dueDate: "2026-10-01", amount: 8000, paidAmount: 3000 },
      { id: "next", status: "pending", dueDate: "2026-11-01", amount: 8000 },
    ]);
    assert.equal(picked?.id, "partial");
  });
});
