import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computePaymentsReadiness } from "@/lib/readiness/compute";
import type { Invoice } from "@/lib/invoices/types";

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-1",
    venueId: "v1",
    clientId: "c1",
    eventId: "e1",
    invoiceNumber: "INV-1",
    status: "sent",
    subtotal: 2400,
    discountAmount: 0,
    taxAmount: 0,
    total: 2400,
    balanceDue: 2400,
    notes: null,
    dueDate: "2026-09-14",
    issuedAt: null,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
    ...overrides,
  } as Invoice;
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
      [invoice({ dueDate: "2027-12-04" })],
      [{ status: "overdue", dueDate: "2026-09-01", amount: 800 }],
    );
    assert.equal(section.status, "needs_attention");
    assert.match(section.detail, /overdue/i);
  });

  it("does not treat void invoices with past due dates as overdue", () => {
    const section = computePaymentsReadiness([
      invoice({ status: "void", balanceDue: 3200, dueDate: "2026-09-08" }),
    ]);
    assert.notEqual(section.status, "needs_attention");
    assert.doesNotMatch(section.detail, /overdue/i);
  });

  it("does not treat draft invoices with past due dates as overdue", () => {
    const section = computePaymentsReadiness([
      invoice({ status: "draft", balanceDue: 2400, dueDate: "2026-09-14" }),
    ]);
    assert.notEqual(section.status, "needs_attention");
    assert.doesNotMatch(section.detail, /overdue/i);
  });

  it("ignores invoice due date when an empty schedule list is provided", () => {
    const section = computePaymentsReadiness(
      [invoice({ status: "draft", balanceDue: 2400, dueDate: "2026-09-14" })],
      [],
    );
    assert.notEqual(section.status, "needs_attention");
    assert.doesNotMatch(section.detail, /overdue/i);
  });
});
