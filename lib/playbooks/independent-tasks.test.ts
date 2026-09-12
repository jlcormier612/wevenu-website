import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { STATUS_CONFIG } from "@/lib/playbooks/constants";
import { computeTaskCenterUrgency } from "@/lib/tasks/task-center";

describe("independent planning tasks", () => {
  it("does not expose a Waiting label for blocked status", () => {
    assert.equal(STATUS_CONFIG.blocked.label, "Pending");
    assert.notEqual(STATUS_CONFIG.blocked.label.toLowerCase(), "waiting");
  });

  it("never buckets historical blocked into a Waiting urgency", () => {
    const today = "2026-09-11";
    const week = "2026-09-18";
    assert.equal(computeTaskCenterUrgency("blocked", "2026-09-20", today, week), "upcoming");
    assert.equal(computeTaskCenterUrgency("blocked", today, today, week), "due_today");
    assert.equal(computeTaskCenterUrgency("blocked", "2026-09-01", today, week), "overdue");
  });
});
