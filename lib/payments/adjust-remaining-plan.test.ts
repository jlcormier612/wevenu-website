import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readFileSync } from "node:fs";

import {
  buildRedistributedRemaining,
  draftLinesFromUnresolved,
  formatAdjustAmountInput,
  parseAdjustAmountInput,
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

  it("exact $12,906.25 outstanding splits into three positive cent-correct installments", () => {
    const balanceDue = 12906.25;
    const invoiceTotal = 15406.25;
    const lines = [
      line({
        id: "initial",
        label: "Initial Payment",
        amount: 2500,
        status: "paid",
        paidAmount: 2500,
        obligationKind: "deposit",
      }),
      line({ id: "p2", label: "Second Payment", amount: 4302.08, status: "pending" }),
      line({ id: "p3", label: "Third Payment", amount: 4302.08, status: "pending" }),
      line({
        id: "final",
        label: "Final Payment",
        amount: 4302.09,
        status: "pending",
        obligationKind: "final",
      }),
    ];
    const proposed = buildRedistributedRemaining({
      balanceDue,
      template: draftLinesFromUnresolved(lines),
      mode: "equal",
    });
    assert.deepEqual(
      proposed.map((p) => p.amount),
      [4302.08, 4302.08, 4302.09],
    );
    const preview = previewAdjustRemainingPlan({
      invoiceTotal,
      balanceDue,
      lines,
      proposedRemaining: proposed,
    });
    assert.equal(preview.ok, true);
    assert.equal(preview.message, undefined);
    assert.equal(preview.paidToDate, 2500);
    assert.equal(preview.proposedRemainingTotal, 12906.25);
    assert.equal(preview.preservedCollected[0]?.paidAmount, 2500);
  });

  it("accepts manually edited positive decimals that still sum to balance due", () => {
    const lines = [
      line({ id: "a", label: "Paid", amount: 2500, status: "paid", paidAmount: 2500 }),
      line({ id: "b", label: "Open", amount: 12906.25, status: "pending" }),
    ];
    const preview = previewAdjustRemainingPlan({
      invoiceTotal: 15406.25,
      balanceDue: 12906.25,
      lines,
      proposedRemaining: [
        { label: "Second Payment", amount: 5000, dueDate: "2027-01-15", obligationKind: "installment" },
        { label: "Third Payment", amount: 4000.25, dueDate: "2027-03-15", obligationKind: "installment" },
        { label: "Final Payment", amount: 3906, dueDate: "2027-05-15", obligationKind: "final" },
      ],
    });
    assert.equal(preview.ok, true);
    assert.equal(preview.proposedRemainingTotal, 12906.25);
  });

  it("rejects zero amounts even when siblings are positive", () => {
    const lines = [
      line({ id: "a", label: "Paid", amount: 2500, status: "paid", paidAmount: 2500 }),
      line({ id: "b", label: "Open", amount: 12906.25, status: "pending" }),
    ];
    const preview = previewAdjustRemainingPlan({
      invoiceTotal: 15406.25,
      balanceDue: 12906.25,
      lines,
      proposedRemaining: [
        { label: "Second Payment", amount: 6453.13, dueDate: "2027-01-15", obligationKind: "installment" },
        { label: "Ghost", amount: 0, dueDate: "2027-02-15", obligationKind: "installment" },
        { label: "Final Payment", amount: 6453.12, dueDate: "2027-03-15", obligationKind: "final" },
      ],
    });
    assert.equal(preview.ok, false);
    assert.match(preview.message ?? "", /greater than zero/i);
  });

  it("proportional mode with all-zero template weights falls back to equal positive split", () => {
    const next = buildRedistributedRemaining({
      balanceDue: 12906.25,
      template: [
        { label: "A", amount: 0, dueDate: "2027-01-01", obligationKind: "installment" },
        { label: "B", amount: 0, dueDate: "2027-02-01", obligationKind: "installment" },
        { label: "C", amount: 0, dueDate: "2027-03-01", obligationKind: "final" },
      ],
      mode: "proportional",
    });
    assert.deepEqual(
      next.map((p) => p.amount),
      [4302.08, 4302.08, 4302.09],
    );
    assert.ok(next.every((p) => p.amount > 0));
  });
});

describe("adjust amount input parsing", () => {
  it("keeps incomplete decimals from coercing to zero or dropping the point", () => {
    assert.equal(parseAdjustAmountInput("").kind, "empty");
    assert.equal(parseAdjustAmountInput("4302.").kind, "incomplete");
    assert.equal(parseAdjustAmountInput(".").kind, "incomplete");
    assert.deepEqual(parseAdjustAmountInput("4302.08"), { kind: "ok", value: 4302.08 });
    assert.deepEqual(parseAdjustAmountInput("$4,302.09"), { kind: "ok", value: 4302.09 });
    assert.equal(parseAdjustAmountInput("12abc").kind, "invalid");
    assert.equal(formatAdjustAmountInput(4302.08), "4302.08");
  });

  it("dialog wires parse helper, stable row keys, and stale-preview sequencing", () => {
    const src = readFileSync("components/invoices/adjust-payment-plan-dialog.tsx", "utf8");
    assert.match(src, /parseAdjustAmountInput/);
    assert.match(src, /formatAdjustAmountInput/);
    assert.match(src, /previewSeq/);
    assert.match(src, /seq !== previewSeq\.current/);
    assert.doesNotMatch(src, /Number\(e\.target\.value\.replace/);
    assert.match(src, /mode:\s*"equal"/);
    assert.match(src, /key=\{line\.key\}/);
  });
});
