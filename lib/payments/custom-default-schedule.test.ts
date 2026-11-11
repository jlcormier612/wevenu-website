import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyCustomScheduleToTotal,
  defaultCustomScheduleTemplate,
  normalizeCustomScheduleTemplate,
  validateCustomScheduleTemplate,
} from "@/lib/payments/custom-default-schedule";

describe("custom default schedule", () => {
  it("rejects percentages that do not total 100%", () => {
    const t = defaultCustomScheduleTemplate("percentage");
    t.items[0]!.pctOfTotal = 20;
    const v = validateCustomScheduleTemplate(t);
    assert.equal(v.ok, false);
    assert.match(v.errors.join(" "), /100%/);
  });

  it("accepts 25/25/25/25 percentage schedule", () => {
    const t = defaultCustomScheduleTemplate("percentage");
    const v = validateCustomScheduleTemplate(t);
    assert.equal(v.ok, true);
  });

  it("rejects negative percentages and amounts", () => {
    const pct = defaultCustomScheduleTemplate("percentage");
    pct.items[0]!.pctOfTotal = -5;
    assert.equal(validateCustomScheduleTemplate(pct).ok, false);

    const dollars = defaultCustomScheduleTemplate("dollar");
    dollars.items = dollars.items.map((it, i) => ({
      ...it,
      amount: i === 0 ? -100 : 100,
      pctOfTotal: 0,
    }));
    assert.equal(validateCustomScheduleTemplate(dollars).ok, false);
  });

  it("applies percentage schedule to $7700 as four $1925 lines", () => {
    const t = defaultCustomScheduleTemplate("percentage");
    const r = applyCustomScheduleToTotal({
      template: t,
      total: 7700,
      today: "2026-09-23",
      eventDate: "2027-06-15",
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.lines.length, 4);
    assert.deepEqual(
      r.lines.map((l) => l.amount),
      [1925, 1925, 1925, 1925],
    );
  });

  it("applies dollar schedule only when totals match", () => {
    const t = defaultCustomScheduleTemplate("dollar");
    t.items = [
      {
        label: "Initial payment",
        pctOfTotal: 0,
        amount: 2500,
        timing: { type: "at_booking" },
        obligationKind: "deposit",
      },
      {
        label: "Payment 2",
        pctOfTotal: 0,
        amount: 2000,
        timing: { type: "before_event", days: 90 },
        obligationKind: "installment",
      },
      {
        label: "Payment 3",
        pctOfTotal: 0,
        amount: 2000,
        timing: { type: "before_event", days: 60 },
        obligationKind: "installment",
      },
      {
        label: "Final payment",
        pctOfTotal: 0,
        amount: 1200,
        timing: { type: "before_event", days: 30 },
        obligationKind: "final",
      },
    ];
    const ok = applyCustomScheduleToTotal({
      template: t,
      total: 7700,
      today: "2026-09-23",
      eventDate: "2027-06-15",
    });
    assert.equal(ok.ok, true);
    if (!ok.ok) return;
    assert.deepEqual(
      ok.lines.map((l) => l.amount),
      [2500, 2000, 2000, 1200],
    );

    const mismatch = applyCustomScheduleToTotal({
      template: t,
      total: 8000,
      today: "2026-09-23",
      eventDate: "2027-06-15",
    });
    assert.equal(mismatch.ok, false);
    if (mismatch.ok) return;
    assert.match(mismatch.message, /match/i);
  });

  it("normalizes stored JSON and drops invalid custom", () => {
    const good = normalizeCustomScheduleTemplate({
      mode: "percentage",
      items: defaultCustomScheduleTemplate("percentage").items,
    });
    assert.ok(good);
    assert.equal(good?.mode, "percentage");

    const bad = normalizeCustomScheduleTemplate({
      mode: "percentage",
      items: [{ label: "X", pctOfTotal: 50, amount: 0, timing: { type: "at_booking" }, obligationKind: "deposit" }],
    });
    assert.equal(bad, null);
  });
});
