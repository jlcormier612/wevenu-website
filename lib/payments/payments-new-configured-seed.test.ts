/**
 * /payments/new must hydrate venue Custom via resolveConfiguredPlanSeed —
 * same authoritative seed as Booking Journey PaymentPlanBuilder.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { resolveConfiguredPlanSeed } from "@/lib/payments/configured-plan-seed";
import type { CustomScheduleTemplate } from "@/lib/payments/custom-default-schedule";

const root = resolve(process.cwd());
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

const sandboxCustom: CustomScheduleTemplate = {
  mode: "percentage",
  items: [
    {
      label: "Sandbox Custom Retainer",
      pctOfTotal: 25,
      amount: 0,
      timing: { type: "due_today" },
      obligationKind: "deposit",
    },
    {
      label: "Payment 2",
      pctOfTotal: 25,
      amount: 0,
      timing: { type: "before_event", days: 90 },
      obligationKind: "installment",
    },
    {
      label: "Payment 3",
      pctOfTotal: 25,
      amount: 0,
      timing: { type: "before_event", days: 60 },
      obligationKind: "installment",
    },
    {
      label: "Final",
      pctOfTotal: 25,
      amount: 0,
      timing: { type: "before_event", days: 30 },
      obligationKind: "final",
    },
  ],
};

describe("/payments/new configured Custom seed", () => {
  const page = read("app/(app)/payments/new/page.tsx");
  const form = read("components/payments/new-schedule-form.tsx");
  const builder = read("components/payments/payment-plan-builder.tsx");
  const sheet = read("components/booking-journey/setup-payments-sheet.tsx");

  it("page passes venue commercial prefs into NewScheduleForm", () => {
    assert.match(page, /commercialBookingPrefs/);
    assert.match(page, /customSchedule=\{prefs\.defaultCustomSchedule\}/);
    assert.match(page, /remainingBalanceMode=\{prefs\.remainingBalanceMode\}/);
    assert.match(page, /defaultDepositPercent=\{prefs\.defaultDepositPercent\}/);
    assert.match(page, /seedPresetId/);
  });

  it("NewScheduleForm consumes resolveConfiguredPlanSeed (not a forked seed)", () => {
    assert.match(form, /resolveConfiguredPlanSeed/);
    assert.match(form, /draftsFromCustomTemplate/);
    assert.match(form, /customSchedule/);
    assert.match(builder, /resolveConfiguredPlanSeed/);
    assert.match(sheet, /customSchedule=\{customSchedule\}/);
  });

  it("booking journey and /payments/new seed the same Sandbox Custom structure", () => {
    const seed = resolveConfiguredPlanSeed({
      remainingBalanceMode: "plan",
      defaultSchedulePresetId: "custom",
      customSchedule: sandboxCustom,
      invoiceTotal: 25000,
    });
    assert.equal(seed.selectedKey, "custom");
    assert.equal(seed.startAt, "build");
    assert.deepEqual(
      seed.lines.map((l) => l.label),
      ["Sandbox Custom Retainer", "Payment 2", "Payment 3", "Final"],
    );
    assert.deepEqual(
      seed.lines.map((l) => l.amount),
      [6250, 6250, 6250, 6250],
    );
    assert.deepEqual(
      seed.lines.map((l) => l.timing),
      [
        { type: "due_today" },
        { type: "before_event", days: 90 },
        { type: "before_event", days: 60 },
        { type: "before_event", days: 30 },
      ],
    );
  });

  it("wedding_four remains correct", () => {
    const seed = resolveConfiguredPlanSeed({
      remainingBalanceMode: "plan",
      defaultSchedulePresetId: "wedding_four",
      customSchedule: null,
      invoiceTotal: 20000,
    });
    assert.equal(seed.initialPresetId, "wedding_four");
    assert.equal(seed.lines.length, 4);
    assert.equal(seed.lines[0]?.label, "Initial Payment");
  });

  it("null custom falls back to generic Custom structure behavior", () => {
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

  it("opening builders does not write venue defaults (read-only seed)", () => {
    assert.doesNotMatch(form, /updateCommercialBookingPrefs|saveCommercialBooking/);
    assert.doesNotMatch(page, /updateCommercialBookingPrefs|saveCommercialBooking/);
    assert.doesNotMatch(builder, /updateCommercialBookingPrefs|saveCommercialBooking/);
  });
});
