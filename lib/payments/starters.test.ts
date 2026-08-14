/**
 * Payment Plan starter helpers — unit tests (node:test).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SCHEDULE_PRESETS } from "@/lib/payments/constants";
import {
  allocatePresetAmounts,
  defaultInvoiceNotes,
  getPaymentPlanStarters,
  paymentMilestoneDescription,
} from "@/lib/payments/starters";

describe("Payment Plan starters", () => {
  it("surfaces Standard Wedding 3 / 4 / Custom with plain language", () => {
    const starters = getPaymentPlanStarters();
    assert.deepEqual(
      starters.map((s) => s.id),
      ["thirds", "wedding_four", "custom"],
    );
    assert.equal(starters[0]!.label, "Standard Wedding — 3 Payments");
    assert.equal(starters[1]!.label, "Standard Wedding — 4 Payments");
    assert.equal(starters[2]!.label, "Custom Payment Schedule");
    assert.deepEqual(
      starters[0]!.items.map((i) => i.label),
      ["Initial Payment", "Planning Payment", "Final Payment"],
    );
    assert.deepEqual(
      starters[1]!.items.map((i) => i.label),
      ["Initial Payment", "Planning Payment 1", "Planning Payment 2", "Final Payment"],
    );
  });

  it("keeps certified percentage splits available", () => {
    assert.ok(SCHEDULE_PRESETS.find((p) => p.id === "fifty_fifty"));
    assert.ok(SCHEDULE_PRESETS.find((p) => p.id === "deposit_30_70"));
  });

  it("reconciles allocated amounts exactly to the invoice total", () => {
    const thirds = SCHEDULE_PRESETS.find((p) => p.id === "thirds")!;
    const amounts = allocatePresetAmounts(10000, thirds.items);
    assert.equal(amounts.reduce((s, a) => s + a, 0), 10000);
    const four = SCHEDULE_PRESETS.find((p) => p.id === "wedding_four")!;
    const q = allocatePresetAmounts(10000.03, four.items);
    assert.equal(Math.round(q.reduce((s, a) => s + a, 0) * 100) / 100, 10000.03);
  });

  it("does not invent legal/fee language in starter labels", () => {
    for (const preset of SCHEDULE_PRESETS) {
      const blob = `${preset.label} ${preset.description} ${preset.items.map((i) => i.label).join(" ")}`;
      assert.doesNotMatch(blob, /late fee|cancell|refund|interest|collection|indemnif/i);
    }
  });

  it("provides safe milestone and invoice note copy", () => {
    assert.match(paymentMilestoneDescription("deposit"), /initial payment/i);
    assert.match(paymentMilestoneDescription("final"), /remaining balance/i);
    assert.match(defaultInvoiceNotes("Garden Hall"), /Garden Hall/);
    assert.doesNotMatch(defaultInvoiceNotes("Garden Hall"), /late fee|cancell/i);
  });
});
