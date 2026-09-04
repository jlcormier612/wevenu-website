/**
 * Payment Plan starter helpers — unit tests (node:test).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SCHEDULE_PRESETS } from "@/lib/payments/constants";
import {
  allocatePresetAmounts,
  defaultInvoiceNotes,
  formatPresetPercent,
  formatRelativeDueLabel,
  formatTimingLabel,
  getPaymentPlanStarters,
  paymentMilestoneDescription,
  previewDueDateFromEvent,
  resolveDueDateFromTiming,
  safePaymentScheduleReturnPath,
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

  it("explains timing in venue-owner language (at booking ≠ event day)", () => {
    assert.equal(formatTimingLabel({ type: "at_booking" }), "At booking");
    assert.equal(formatTimingLabel({ type: "before_event", days: 60 }), "60 days before the event");
    assert.equal(formatTimingLabel({ type: "before_event", days: 0 }), "On the event day");
    assert.equal(formatTimingLabel({ type: "after_booking", days: 30 }), "30 days after booking");
    assert.notEqual(
      formatTimingLabel({ type: "at_booking" }),
      formatTimingLabel({ type: "before_event", days: 0 }),
    );
    // Legacy offset helper still works for event-relative copy.
    assert.equal(formatRelativeDueLabel(-60), "60 days before the event");
    assert.equal(formatRelativeDueLabel(0), "On the event day");
    assert.equal(formatPresetPercent(25), "25%");
    assert.equal(formatPresetPercent(33.33), "about 33%");
    assert.equal(previewDueDateFromEvent("2026-10-17", -60), "2026-08-18");
  });

  it("resolves concrete due dates from timing rules without collapsing at-booking into event day", () => {
    const eventDate = "2026-10-17";
    const bookingDate = "2025-01-10";
    assert.equal(
      resolveDueDateFromTiming({ type: "before_event", days: 60 }, { eventDate, bookingDate }),
      "2026-08-18",
    );
    assert.equal(
      resolveDueDateFromTiming({ type: "before_event", days: 0 }, { eventDate, bookingDate }),
      "2026-10-17",
    );
    assert.equal(
      resolveDueDateFromTiming({ type: "at_booking" }, { eventDate, bookingDate }),
      "2025-01-10",
    );
    assert.equal(
      resolveDueDateFromTiming({ type: "after_booking", days: 30 }, { eventDate, bookingDate }),
      "2025-02-09",
    );
    assert.equal(
      resolveDueDateFromTiming({ type: "at_booking" }, { eventDate, bookingDate: null }),
      null,
    );
  });

  it("starter deposit lines use at booking; later lines use before event", () => {
    const thirds = SCHEDULE_PRESETS.find((p) => p.id === "thirds")!;
    assert.equal(thirds.items[0]!.timing.type, "at_booking");
    assert.deepEqual(thirds.items[1]!.timing, { type: "before_event", days: 90 });
    assert.deepEqual(thirds.items[2]!.timing, { type: "before_event", days: 30 });

    const mixed = allocatePresetAmounts(10000, [
      { pctOfTotal: 50 },
      { pctOfTotal: 25 },
      { pctOfTotal: 25 },
    ]);
    assert.deepEqual(mixed, [5000, 2500, 2500]);
    const ctx = { eventDate: "2026-10-17", bookingDate: "2025-09-03" };
    assert.equal(resolveDueDateFromTiming({ type: "at_booking" }, ctx), "2025-09-03");
    assert.equal(resolveDueDateFromTiming({ type: "before_event", days: 60 }, ctx), "2026-08-18");
    assert.equal(resolveDueDateFromTiming({ type: "before_event", days: 14 }, ctx), "2026-10-03");
  });

  it("only allows safe /payments return paths for invoice handoff", () => {
    assert.equal(safePaymentScheduleReturnPath("/payments/new?preset=thirds"), "/payments/new?preset=thirds");
    assert.equal(safePaymentScheduleReturnPath("https://evil.example/payments"), null);
    assert.equal(safePaymentScheduleReturnPath("//evil.example"), null);
    assert.equal(safePaymentScheduleReturnPath("/invoices/abc"), null);
  });
});
