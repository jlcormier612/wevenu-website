import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  STANDARD_VENUE_WORKFLOW_MILESTONES,
  STANDARD_VENUE_WORKFLOW_TASKS,
  VENUE_FINAL_DETAILS_TASK_TITLES,
  VENUE_PLANNING_PREP_TASK_TITLES,
} from "@/lib/playbooks/constants";

describe("Standard Wedding — Venue Planning starter", () => {
  it("A — no booking milestone or commercial booking tasks", () => {
    const names = STANDARD_VENUE_WORKFLOW_MILESTONES.map((m) => m.name);
    assert.deepEqual(names, ["Planning", "Final Details", "Wedding Day", "Post-Event"]);
    const titles = STANDARD_VENUE_WORKFLOW_TASKS.map((t) => t.title);
    assert.ok(!titles.includes("Send contract"));
    assert.ok(!titles.includes("Verify deposit"));
  });

  it("B — preparatory tasks sit on Planning", () => {
    const planningIndex = STANDARD_VENUE_WORKFLOW_MILESTONES.findIndex((m) => m.name === "Planning");
    assert.equal(planningIndex, 0);
    for (const title of VENUE_PLANNING_PREP_TASK_TITLES) {
      const task = STANDARD_VENUE_WORKFLOW_TASKS.find((t) => t.title === title);
      assert.ok(task, title);
      assert.equal(task.milestoneIndex, planningIndex);
      assert.equal(task.daysOffset < 0 || task.daysOffset === 0, true);
    }
  });

  it("C — Final Details is late-stage readiness only", () => {
    const finalIndex = STANDARD_VENUE_WORKFLOW_MILESTONES.findIndex((m) => m.name === "Final Details");
    const finalTasks = STANDARD_VENUE_WORKFLOW_TASKS.filter((t) => t.milestoneIndex === finalIndex);
    assert.deepEqual(
      finalTasks.map((t) => t.title),
      [...VENUE_FINAL_DETAILS_TASK_TITLES],
    );
    assert.ok(!finalTasks.some((t) => VENUE_PLANNING_PREP_TASK_TITLES.includes(t.title as typeof VENUE_PLANNING_PREP_TASK_TITLES[number])));
  });

  it("I — due offsets stay on the tasks that remain", () => {
    const timeline = STANDARD_VENUE_WORKFLOW_TASKS.find((t) => t.title === "Build timeline");
    const floor = STANDARD_VENUE_WORKFLOW_TASKS.find((t) => t.title === "Create floor plan");
    const rentals = STANDARD_VENUE_WORKFLOW_TASKS.find((t) => t.title === "Confirm rentals");
    const coi = STANDARD_VENUE_WORKFLOW_TASKS.find((t) => t.title === "Vendor COIs in file");
    assert.equal(timeline?.daysOffset, -21);
    assert.equal(floor?.daysOffset, -14);
    assert.equal(rentals?.daysOffset, -14);
    assert.equal(coi?.daysOffset, -7);
    assert.equal(timeline?.autoCompleteTrigger, "timeline_created");
    assert.equal(floor?.autoCompleteTrigger, "floor_plan_created");
  });

  it("library migration updates PB-VENUE-01 only and does not delete event tasks", () => {
    const sql = readFileSync(
      resolve("supabase/migrations/20261411400000_venue_planning_starter_drop_booking.sql"),
      "utf8",
    );
    assert.match(sql, /source_master_key = 'PB-VENUE-01'/);
    assert.match(sql, /Send contract/);
    assert.match(sql, /Verify deposit/);
    assert.match(sql, /name = 'Planning'/);
    assert.doesNotMatch(sql, /delete from public\.event_tasks/i);
    assert.doesNotMatch(sql, /PB-CLIENT-01/);
  });
});
