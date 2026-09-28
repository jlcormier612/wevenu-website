import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  STANDARD_CLIENT_PLANNING_MILESTONES,
  STANDARD_CLIENT_PLANNING_TASKS,
  STANDARD_VENUE_WORKFLOW_MILESTONES,
  STANDARD_VENUE_WORKFLOW_TASKS,
} from "@/lib/playbooks/constants";

describe("Standard Wedding — Client Planning starter has no pre-booking milestone", () => {
  it("does not include a Booking milestone or pre-booking tasks", () => {
    const names = STANDARD_CLIENT_PLANNING_MILESTONES.map((m) => m.name);
    assert.deepEqual(names, ["Planning", "Final Details", "After Your Day"]);
    assert.ok(!names.includes("Booking"));

    const titles = STANDARD_CLIENT_PLANNING_TASKS.map((t) => t.title);
    assert.equal(titles.length, 8);
    assert.ok(!titles.includes("Sign your contract"));
    assert.ok(!titles.includes("Choose your package"));
    assert.ok(titles.includes("Complete your questionnaire"));
    assert.ok(titles.includes("Final payment"));
    assert.ok(titles.includes("Leave a review"));
  });

  it("keeps remaining tasks on post-booking milestones with contiguous indexes", () => {
    const indexes = STANDARD_CLIENT_PLANNING_TASKS.map((t) => t.milestoneIndex);
    assert.deepEqual([...new Set(indexes)].sort(), [0, 1, 2]);
    assert.ok(STANDARD_CLIENT_PLANNING_TASKS.every((t) => t.milestoneIndex >= 0 && t.milestoneIndex <= 2));
    assert.equal(
      STANDARD_CLIENT_PLANNING_TASKS.filter((t) => t.milestoneIndex === 0).length,
      3,
    );
    assert.equal(
      STANDARD_CLIENT_PLANNING_TASKS.filter((t) => t.milestoneIndex === 1).length,
      4,
    );
    assert.equal(
      STANDARD_CLIENT_PLANNING_TASKS.filter((t) => t.milestoneIndex === 2).length,
      1,
    );
    const sortOrders = STANDARD_CLIENT_PLANNING_TASKS.map((t) => t.sortOrder);
    assert.deepEqual(sortOrders, [0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("does not change the Venue Planning starter Booking milestone", () => {
    assert.equal(STANDARD_VENUE_WORKFLOW_MILESTONES[0]?.name, "Booking");
    assert.ok(STANDARD_VENUE_WORKFLOW_TASKS.some((t) => t.title === "Send contract"));
    assert.ok(STANDARD_VENUE_WORKFLOW_TASKS.some((t) => t.title === "Verify deposit"));
  });

  it("createFromReference still seeds from these constants", () => {
    const service = readFileSync(resolve("lib/playbooks/service.ts"), "utf8");
    const create = service.slice(service.indexOf("export async function createStandardClientPlanningTemplate"));
    assert.match(create, /STANDARD_CLIENT_PLANNING_MILESTONES, STANDARD_CLIENT_PLANNING_TASKS/);
    assert.doesNotMatch(create, /Sign your contract/);
    assert.doesNotMatch(create, /Choose your package/);
  });

  it("library-copy migration is scoped to PB-CLIENT-01 and does not delete event_tasks", () => {
    const sql = readFileSync(
      resolve("supabase/migrations/20261408400000_client_planning_starter_drop_booking_milestone.sql"),
      "utf8",
    );
    assert.match(sql, /source_master_key = 'PB-CLIENT-01'/);
    assert.match(sql, /m\.name = 'Booking'/);
    assert.doesNotMatch(sql, /delete from public\.event_tasks/i);
    assert.doesNotMatch(sql, /PB-VENUE-01/);
  });
});
