import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  collectedCash,
  effectForKind,
  reconcileInvoiceBalance,
} from "@/lib/migration/financial-activity";

describe("imported invoice reconciliation", () => {
  it("keeps each payment, refund, reallocation, and credit, and does not double-count", () => {
    const movements = [
      { kind: "payment" as const, amount: 1000, effect: effectForKind("payment")! },
      { kind: "payment" as const, amount: 500, effect: effectForKind("payment")! },
      { kind: "refund" as const, amount: 200, effect: effectForKind("refund")! },
      { kind: "reallocation_out" as const, amount: 300, effect: effectForKind("reallocation_out")! },
      { kind: "credit" as const, amount: 500, effect: effectForKind("credit")! },
    ];
    const result = reconcileInvoiceBalance({ invoiceTotal: 10000, movements });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.collected, 1000);
    assert.equal(result.remaining, 8500);
  });

  it("holds a row when the stated remaining balance does not match", () => {
    const result = reconcileInvoiceBalance({
      invoiceTotal: 1000,
      movements: [{ kind: "payment", amount: 400, effect: "reduces_balance" }],
      statedRemaining: 100,
    });
    assert.equal(result.ok, false);
  });

  it("holds a row when activity exceeds the invoice instead of inventing a balance", () => {
    const result = reconcileInvoiceBalance({
      invoiceTotal: 100,
      movements: [{ kind: "payment", amount: 150, effect: "reduces_balance" }],
    });
    assert.equal(result.ok, false);
  });

  it("does not treat a credit as collected cash", () => {
    assert.equal(collectedCash([
      { kind: "credit", amount: 250, effect: "reduces_balance" },
    ]), 0);
  });

  it("requires an explicit direction for an adjustment", () => {
    assert.equal(effectForKind("adjustment", null), null);
    assert.equal(effectForKind("adjustment", "increases_balance"), "increases_balance");
  });
});
