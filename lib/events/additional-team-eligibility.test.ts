/**
 * Additional team member eligibility — owner exclusion, duplicates, legacy names.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  filterEligibleAdditionalStaff,
  staffNamesMatch,
} from "@/lib/events/additional-team-eligibility";

const staff = [
  { id: "a", name: "Jennifer Cormier" },
  { id: "b", name: "Alex Rivera" },
  { id: "c", name: "Sam Patel" },
];

describe("additional team eligibility", () => {
  it("matches staff names case-insensitively with trim", () => {
    assert.equal(staffNamesMatch("Jennifer Cormier", " jennifer cormier "), true);
    assert.equal(staffNamesMatch("Alex", "Sam"), false);
  });

  it("excludes the event owner by id and by name", () => {
    const eligible = filterEligibleAdditionalStaff(staff, [], "a");
    assert.deepEqual(
      eligible.map((s) => s.id),
      ["b", "c"],
    );
  });

  it("excludes members already assigned (including legacy free-text casing)", () => {
    const eligible = filterEligibleAdditionalStaff(
      staff,
      ["alex rivera", "External DJ"],
      null,
    );
    assert.deepEqual(
      eligible.map((s) => s.id),
      ["a", "c"],
    );
  });

  it("excludes both owner and existing assignments together", () => {
    const eligible = filterEligibleAdditionalStaff(staff, ["Sam Patel"], "a");
    assert.deepEqual(
      eligible.map((s) => s.id),
      ["b"],
    );
  });

  it("returns empty when every internal member is owner or already assigned", () => {
    const eligible = filterEligibleAdditionalStaff(
      staff,
      ["Alex Rivera", "Sam Patel"],
      "a",
    );
    assert.deepEqual(eligible, []);
  });

  it("does not invent staff outside the venue options list", () => {
    const eligible = filterEligibleAdditionalStaff(
      staff,
      [],
      null,
    );
    assert.equal(eligible.length, 3);
    assert.ok(eligible.every((s) => staff.some((o) => o.id === s.id)));
  });
});
