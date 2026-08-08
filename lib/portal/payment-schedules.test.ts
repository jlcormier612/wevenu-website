import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  remainingBalanceFromSchedules,
  selectCanonicalPaymentSchedules,
} from "@/lib/portal/payment-schedules";

describe("selectCanonicalPaymentSchedules", () => {
  it("keeps newest schedule when invoice_id collides", () => {
    const out = selectCanonicalPaymentSchedules([
      {
        id: "old",
        title: "Old",
        invoiceId: "inv",
        createdAt: "2026-01-01T00:00:00Z",
        lineItems: [{ id: "a", label: "A", amount: 1, dueDate: null, status: "pending" }],
      },
      {
        id: "new",
        title: "New",
        invoiceId: "inv",
        createdAt: "2026-06-01T00:00:00Z",
        lineItems: [{ id: "b", label: "B", amount: 2, dueDate: null, status: "pending" }],
      },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0]?.id, "new");
    assert.equal(remainingBalanceFromSchedules(out), 2);
  });

  it("does not collapse distinct invoices", () => {
    const out = selectCanonicalPaymentSchedules([
      {
        id: "1",
        title: "One",
        invoiceId: "inv-a",
        createdAt: "2026-01-01",
        lineItems: [{ id: "a", label: "A", amount: 10, dueDate: null, status: "pending" }],
      },
      {
        id: "2",
        title: "Two",
        invoiceId: "inv-b",
        createdAt: "2026-01-02",
        lineItems: [{ id: "b", label: "B", amount: 20, dueDate: null, status: "pending" }],
      },
    ]);
    assert.equal(out.length, 2);
    assert.equal(remainingBalanceFromSchedules(out), 30);
  });
});
