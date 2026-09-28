import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  draftsFromCustomTemplate,
  resolveConfiguredPlanSeed,
} from "@/lib/payments/configured-plan-seed";
import type { CustomScheduleTemplate } from "@/lib/payments/custom-default-schedule";

const customTemplate: CustomScheduleTemplate = {
  mode: "percentage",
  items: [
    {
      label: "Retainer",
      pctOfTotal: 40,
      amount: 0,
      timing: { type: "due_today" },
      obligationKind: "deposit",
    },
    {
      label: "Balance",
      pctOfTotal: 60,
      amount: 0,
      timing: { type: "before_event", days: 45 },
      obligationKind: "final",
    },
  ],
};

describe("resolveConfiguredPlanSeed", () => {
  it("opens wedding_four as the configured plan with four labeled lines", () => {
    const seed = resolveConfiguredPlanSeed({
      remainingBalanceMode: "plan",
      defaultSchedulePresetId: "wedding_four",
      customSchedule: null,
      invoiceTotal: 20000,
      defaultDeposit: 5000,
    });
    assert.equal(seed.startAt, "build");
    assert.equal(seed.selectedKey, "preset");
    assert.equal(seed.initialPresetId, "wedding_four");
    assert.equal(seed.lines.length, 4);
    assert.deepEqual(seed.lines.map((l) => l.label), [
      "Initial Payment",
      "Planning Payment 1",
      "Planning Payment 2",
      "Final Payment",
    ]);
    assert.deepEqual(seed.lines.map((l) => l.amount), [5000, 5000, 5000, 5000]);
  });

  it("opens an alternate FAST_PRESET as configured", () => {
    const seed = resolveConfiguredPlanSeed({
      remainingBalanceMode: "plan",
      defaultSchedulePresetId: "thirds",
      invoiceTotal: 9000,
    });
    assert.equal(seed.initialPresetId, "thirds");
    assert.equal(seed.lines.length, 3);
    assert.equal(seed.selectedKey, "preset");
  });

  it("does not silently turn remainingBalanceMode final into generic four-equal", () => {
    const seed = resolveConfiguredPlanSeed({
      remainingBalanceMode: "final",
      defaultSchedulePresetId: "deposit_remaining",
      invoiceTotal: 10000,
      defaultDeposit: 2500,
    });
    assert.equal(seed.selectedKey, "deposit_remaining");
    assert.equal(seed.lines.length, 2);
    assert.equal(seed.lines[0]?.label, "Deposit");
    assert.equal(seed.lines[0]?.amount, 2500);
    assert.equal(seed.lines[1]?.label, "Remaining balance");
    assert.equal(seed.lines[1]?.amount, 7500);
    assert.notEqual(seed.lines.length, 4);
  });

  it("does not silently turn an invalid mapping into generic four-equal", () => {
    const seed = resolveConfiguredPlanSeed({
      remainingBalanceMode: "plan",
      defaultSchedulePresetId: "deposit_remaining",
      invoiceTotal: 8000,
      defaultDeposit: 2000,
    });
    assert.equal(seed.selectedKey, "deposit_remaining");
    assert.equal(seed.lines.length, 2);
    assert.notDeepEqual(
      seed.lines.map((l) => l.amount),
      [2000, 2000, 2000, 2000],
    );
  });

  it("hydrates a saved custom default into builder lines", () => {
    const seed = resolveConfiguredPlanSeed({
      remainingBalanceMode: "plan",
      defaultSchedulePresetId: "custom",
      customSchedule: customTemplate,
      invoiceTotal: 10000,
    });
    assert.equal(seed.selectedKey, "custom");
    assert.equal(seed.startAt, "build");
    assert.equal(seed.lines.length, 2);
    assert.equal(seed.lines[0]?.label, "Retainer");
    assert.equal(seed.lines[0]?.amount, 4000);
    assert.equal(seed.lines[1]?.label, "Balance");
    assert.equal(seed.lines[1]?.amount, 6000);
  });

  it("retains current Custom behavior when no saved custom schedule exists", () => {
    const seed = resolveConfiguredPlanSeed({
      remainingBalanceMode: "plan",
      defaultSchedulePresetId: "custom",
      customSchedule: null,
      invoiceTotal: 8000,
    });
    assert.equal(seed.selectedKey, "custom");
    assert.equal(seed.startAt, "structure");
    assert.equal(seed.lines.length, 4);
  });
});

describe("draftsFromCustomTemplate", () => {
  it("maps a saved custom template onto builder drafts", () => {
    const drafts = draftsFromCustomTemplate(customTemplate, 5000);
    assert.ok(drafts);
    assert.equal(drafts?.length, 2);
    assert.equal(drafts?.[0]?.timing.type, "due_today");
    assert.equal(drafts?.[1]?.timing.type, "before_event");
  });
});
