/**
 * Venue task coherence: lead one-off tasks share Task Center assignment model.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";

const root = path.join(import.meta.dirname, "../..");

function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("venue task coherence", () => {
  it("lead workspace labels one-off tasks as venue tasks with due date", () => {
    const section = read("components/leads/tasks-section.tsx");
    const detail = read("components/leads/lead-detail.tsx");
    assert.match(detail, /Venue tasks/);
    assert.match(detail, /One-off things your team needs to do for this lead/);
    assert.match(section, /Due date/);
    assert.match(section, /Assignee/);
    assert.match(section, /assignedToStaffId/);
  });

  it("Task Center loads incomplete lead_tasks into the DO lane", () => {
    const page = read("app/(app)/tasks/page.tsx");
    assert.match(page, /from\("lead_tasks"\)/);
    assert.match(page, /record_kind: "lead_task"/);
    assert.match(page, /owner_type: "coordinator"/);
  });

  it("conversion migrates lead tasks onto the event without duplicating", () => {
    const repo = read("lib/leads/repository.ts");
    const clients = read("lib/clients/service.ts");
    assert.match(repo, /migrateLeadTasksToEvent/);
    assert.match(repo, /from\("event_tasks"\)\.insert/);
    assert.match(repo, /from\("lead_tasks"\)[\s\S]*\.delete/);
    assert.match(clients, /migrateLeadTasksToEvent/);
  });

  it("My Work still filters by assigned_to_staff_id", () => {
    const center = read("components/tasks/task-center.tsx");
    assert.match(center, /assigned_to_staff_id === currentStaffId/);
    assert.match(center, /setTaskCompletedAction/);
  });
});
