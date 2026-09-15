import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

  it("playbook builder never surfaces depends-on chaining", () => {
    const src = readFileSync(join(process.cwd(), "components/playbooks/playbook-builder.tsx"), "utf8");
    assert.doesNotMatch(src, /Depends on/);
    assert.match(src, /dependsOnTaskId: null/);
  });

  it("repository forces dependency columns to null", () => {
    const src = readFileSync(join(process.cwd(), "lib/playbooks/repository.ts"), "utf8");
    assert.match(src, /depends_on_task_id: null/);
    assert.match(src, /dependsOnEventTaskId: null/);
  });
});
