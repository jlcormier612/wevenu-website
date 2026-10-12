import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildRedistributedRemaining,
  draftLinesFromUnresolved,
  previewAdjustRemainingPlan,
} from "@/lib/payments/adjust-remaining-plan";
import type { PaymentLineItem } from "@/lib/payments/types";

function line(
  overrides: Partial<PaymentLineItem> & Pick<PaymentLineItem, "id" | "label" | "amount" | "status">,
): PaymentLineItem {
  return {
    venueId: "v",
    scheduleId: "s",
    dueDate: "2026-11-01",
    paidAmount: null,
    paidAt: null,
    paymentMethod: null,
    referenceNumber: null,
    notes: null,
    sortOrder: 0,
    obligationKind: "installment",
    refundedAmount: 0,
    refundedAt: null,
    refundReason: null,
    quickbooksSyncStatus: "not_synced",
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    stripePaymentMethodType: null,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

describe("previewAdjustRemainingPlan", () => {
  it("Nicole/Colby-style partial: preserves receipt, requires remaining = balance due", () => {
    const lines = [
      line({
        id: "initial",
        label: "Initial Payment",
        amount: 9164.06,
        status: "partially_paid",
        paidAmount: 7164.06,
        obligationKind: "deposit",
      }),
      line({
        id: "p2",
        label: "Second Payment",
        amount: 9164.06,
        status: "pending",
      }),
      line({
        id: "p3",
        label: "Third Payment",
        amount: 9164.06,
        status: "pending",
      }),
      line({
        id: "final",
        label: "Final Payment",
        amount: 9164.07,
        status: "pending",
        obligationKind: "final",
      }),
    ];
    const invoiceTotal = 36656.25;
    const balanceDue = 29492.19;
    const proposed = buildRedistributedRemaining({
      balanceDue,
      template: draftLinesFromUnresolved(lines),
      mode: "equal",
    });
    const preview = previewAdjustRemainingPlan({
      invoiceTotal,
      balanceDue,
      lines,
      proposedRemaining: proposed,
    });
    assert.equal(preview.ok, true);
    assert.equal(preview.paidToDate, 7164.06);
    assert.equal(preview.closedPartialShortfall, 2000);
    assert.equal(preview.proposedRemainingTotal, 29492.19);
    assert.equal(preview.discrepancy, 0);
    assert.equal(preview.preservedCollected.length, 1);
    assert.equal(preview.preservedCollected[0]?.paidAmount, 7164.06);
  });

  it("rejects over-allocation", () => {
    const lines = [
      line({ id: "a", label: "Paid", amount: 1000, status: "paid", paidAmount: 1000 }),
      line({ id: "b", label: "Open", amount: 1000, status: "pending" }),
    ];
    const preview = previewAdjustRemainingPlan({
      invoiceTotal: 2000,
      balanceDue: 1000,
      lines,
      proposedRemaining: [
        { label: "Open", amount: 600, dueDate: "2026-12-01", obligationKind: "installment" },
        { label: "Extra", amount: 500, dueDate: "2027-01-01", obligationKind: "installment" },
      ],
    });
    assert.equal(preview.ok, false);
    assert.ok(preview.discrepancy > 0);
    assert.match(preview.message ?? "", /exceed/i);
  });

  it("rejects under-allocation", () => {
    const lines = [
      line({ id: "a", label: "Paid", amount: 500, status: "paid", paidAmount: 500 }),
      line({ id: "b", label: "Open", amount: 1500, status: "pending" }),
    ];
    const preview = previewAdjustRemainingPlan({
      invoiceTotal: 2000,
      balanceDue: 1500,
      lines,
      proposedRemaining: [
        { label: "Open", amount: 1000, dueDate: "2026-12-01", obligationKind: "installment" },
      ],
    });
    assert.equal(preview.ok, false);
    assert.ok(preview.discrepancy < 0);
    assert.match(preview.message ?? "", /short/i);
  });

  it("proportional redistribute preserves relative weights and cents", () => {
    const next = buildRedistributedRemaining({
      balanceDue: 100,
      template: [
        { label: "A", amount: 30, dueDate: "2026-11-01", obligationKind: "installment" },
        { label: "B", amount: 70, dueDate: "2026-12-01", obligationKind: "installment" },
      ],
      mode: "proportional",
    });
    const sum = next.reduce((s, l) => s + l.amount, 0);
    assert.equal(Math.round(sum * 100) / 100, 100);
    assert.equal(next[0]?.amount, 30);
    assert.equal(next[1]?.amount, 70);
  });
});
