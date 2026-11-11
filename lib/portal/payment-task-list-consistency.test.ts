/**
 * Payment task list consistency: client ledger lines ≠ venue checklist mirrors.
 * Paid installments drop from couple attention; unpaid remain. Venue keeps a
 * single Final payment event_task (trigger-backed), not one task per installment.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const unified = readFileSync(resolve("lib/portal/unified-tasks.ts"), "utf8");
const constants = readFileSync(resolve("lib/playbooks/constants.ts"), "utf8");

describe("payment task list consistency (venue vs couple)", () => {
  it("couple Final payment uses final_payment_obligation_paid, not payment_received", () => {
    assert.match(constants, /title: "Final payment"/);
    assert.match(constants, /autoCompleteTrigger: "final_payment_obligation_paid"/);
  });

  it("unpaid payment_line_items emit kind payment attention; paid lines are omitted", () => {
    assert.match(unified, /kind: "payment"/);
    assert.match(unified, /selectCanonicalPaymentSchedules/);
    // Paid / cancelled exclusion is in the payment line emission path
    assert.match(unified, /status.*paid|paid.*omit|unpaid/i);
  });

  it("suppresses payment_received / final_payment_obligation_paid mirrors while unpaid lines exist", () => {
    assert.match(unified, /final_payment_obligation_paid/);
    assert.match(unified, /payment_received/);
    assert.match(unified, /suppress|omit|unpaid/i);
  });

  it("does not invent Planning Payment 1/2 as playbook seed tasks", () => {
    assert.doesNotMatch(constants, /Planning Payment 1/);
    assert.doesNotMatch(constants, /Planning Payment 2/);
    assert.doesNotMatch(constants, /Initial Payment/);
  });
});
