import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computePaymentsReadiness } from "@/lib/readiness/compute";
function invoice(dueDate = "2026-09-14") {
  return { balanceDue: 2400, dueDate } as import("@/lib/invoices/types").Invoice;
}

describe("Payments readiness uses the schedule, not invoice due date", () => {
  it("does not call a paid-deposit invoice overdue when remaining is later", () => {
    const section = computePaymentsReadiness(
      [invoice()],
      [
        { status: "paid", dueDate: "2026-09-14", amount: 800 },
        { status: "pending", dueDate: "2027-12-04", amount: 2400 },
      ],
    );
    assert.notEqual(section.status, "needs_attention");
    assert.doesNotMatch(section.detail, /overdue/i);
    assert.match(section.detail, /2027-12-04/);
  });

  it("still flags a truly overdue installment", () => {
    const section = computePaymentsReadiness(
      [invoice("2027-12-04")],
      [{ status: "overdue", dueDate: "2026-09-01", amount: 800 }],
    );
    assert.equal(section.status, "needs_attention");
    assert.match(section.detail, /overdue/i);
  });
});
