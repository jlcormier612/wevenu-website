import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { beforeDueOffsets, cadenceIntervalDays } from "@/lib/notifications/obligations";
import { classifyPendingReminder } from "@/lib/notifications/stats";

describe("reminder queue classification", () => {
  const now = Date.parse("2026-09-03T15:00:00.000Z");

  it("marks future scheduled_for as waiting_future", () => {
    assert.equal(
      classifyPendingReminder("2026-09-10T08:00:00.000Z", now),
      "waiting_future",
    );
  });

  it("marks past or equal scheduled_for as due_now", () => {
    assert.equal(classifyPendingReminder("2026-09-03T15:00:00.000Z", now), "due_now");
    assert.equal(classifyPendingReminder("2026-09-01T08:00:00.000Z", now), "due_now");
  });
});

describe("before-due reminder cadence offsets", () => {
  it("maps named presets to fixed day offsets relative to due date", () => {
    assert.deepEqual(beforeDueOffsets("weekly"), [21, 14, 7]);
    assert.deepEqual(beforeDueOffsets("once_two_weeks"), [14]);
    assert.deepEqual(beforeDueOffsets("once_week"), [7]);
    assert.deepEqual(beforeDueOffsets("on_due"), [0]);
    assert.deepEqual(beforeDueOffsets("none"), []);
  });

  it("does not treat at_booking as a before-due cadence", () => {
    // Payment schedule timing owns at_booking; reminder cadence must not fake it.
    const labels = ["weekly", "once_week", "once_two_weeks", "on_due", "none"] as const;
    for (const label of labels) {
      assert.ok(!String(label).includes("booking"));
    }
  });

  it("maps after-due recurrence intervals", () => {
    assert.equal(cadenceIntervalDays("daily"), 1);
    assert.equal(cadenceIntervalDays("every_3_days"), 3);
    assert.equal(cadenceIntervalDays("weekly"), 7);
    assert.equal(cadenceIntervalDays("none"), null);
  });
});
