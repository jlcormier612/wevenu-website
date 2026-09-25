import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertRequestablePaymentPlan,
  classifyCommitmentReconcile,
  commitmentMismatchCopy,
  planTotalsReconcile,
  recalculateLineAmounts,
  scheduledPlanTotal,
} from "@/lib/payments/reconcile-commitment";

describe("classifyCommitmentReconcile", () => {
  it("treats matching totals as current", () => {
    const d = classifyCommitmentReconcile({
      scheduleTotal: 15000,
      commitmentTotal: 15000,
      lineAmounts: [3750, 3750, 3750, 3750],
      hasActivity: false,
    });
    assert.equal(d.kind, "current");
  });

  it("auto-recalculates unused equal installments", () => {
    const d = classifyCommitmentReconcile({
      scheduleTotal: 15000,
      commitmentTotal: 32000,
      lineAmounts: [3750, 3750, 3750, 3750],
      hasActivity: false,
    });
    assert.equal(d.kind, "auto_recalc");
    assert.equal(d.reason, "equal_installments");
    const next = recalculateLineAmounts({
      previousAmounts: [3750, 3750, 3750, 3750],
      previousTotal: 15000,
      nextTotal: 32000,
    });
    assert.deepEqual(next, [8000, 8000, 8000, 8000]);
  });

  it("auto-recalculates unused known presets like 30/70", () => {
    const d = classifyCommitmentReconcile({
      scheduleTotal: 15000,
      commitmentTotal: 32000,
      lineAmounts: [4500, 10500],
      hasActivity: false,
    });
    assert.equal(d.kind, "auto_recalc");
    assert.equal(d.reason, "known_preset");
    const next = recalculateLineAmounts({
      previousAmounts: [4500, 10500],
      previousTotal: 15000,
      nextTotal: 32000,
    });
    assert.equal(next.reduce((s, n) => s + n, 0), 32000);
    assert.equal(next[0], 9600);
    assert.equal(next[1], 22400);
  });

  it("requires review for customized unused amounts", () => {
    const d = classifyCommitmentReconcile({
      scheduleTotal: 15000,
      commitmentTotal: 32000,
      lineAmounts: [2000, 4000, 9000],
      hasActivity: false,
    });
    assert.equal(d.kind, "needs_review");
    assert.equal(d.reason, "customized");
  });

  it("locks when payments have already been requested or paid", () => {
    const d = classifyCommitmentReconcile({
      scheduleTotal: 15000,
      commitmentTotal: 32000,
      lineAmounts: [3750, 3750, 3750, 3750],
      hasActivity: true,
    });
    assert.equal(d.kind, "locked");
  });
});

describe("assertRequestablePaymentPlan", () => {
  it("allows a request only when the schedule equals the commitment", () => {
    assert.equal(
      assertRequestablePaymentPlan({
        commitmentTotal: 32000,
        lines: [
          { amount: 8000, status: "pending" },
          { amount: 8000, status: "pending" },
          { amount: 8000, status: "pending" },
          { amount: 8000, status: "pending" },
        ],
      }).ok,
      true,
    );
    const blocked = assertRequestablePaymentPlan({
      commitmentTotal: 32000,
      lines: [
        { amount: 3750, status: "pending" },
        { amount: 3750, status: "pending" },
        { amount: 3750, status: "pending" },
        { amount: 3750, status: "pending" },
      ],
    });
    assert.equal(blocked.ok, false);
    if (blocked.ok) return;
    assert.equal(blocked.title, "Payment plan needs review");
    assert.match(blocked.body, /\$15,000/);
    assert.match(blocked.body, /\$32,000/);
  });

  it("uses the locked mismatch copy", () => {
    const copy = commitmentMismatchCopy(15000, 32000);
    assert.equal(copy.title, "Payment plan needs review");
    assert.equal(
      copy.body,
      "The booking total changed from $15,000.00 to $32,000.00. The current payment schedule still totals $15,000.00. Review the payment plan before requesting payment.",
    );
  });

  it("ignores cancelled lines in the scheduled total", () => {
    assert.equal(
      scheduledPlanTotal([
        { amount: 8000, status: "pending" },
        { amount: 8000, status: "cancelled" },
      ]),
      8000,
    );
    assert.equal(planTotalsReconcile(8000, 8000), true);
  });
});
