import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Models scheduled_messages claim: only one worker wins scheduled → sending.
 */
function claim(
  rows: Map<string, { status: string }>,
  id: string,
): boolean {
  const row = rows.get(id);
  if (!row || row.status !== "scheduled") return false;
  row.status = "sending";
  return true;
}

describe("scheduled message claim concurrency", () => {
  it("two workers cannot both claim the same due message", () => {
    const rows = new Map([["m1", { status: "scheduled" }]]);
    assert.equal(claim(rows, "m1"), true);
    assert.equal(claim(rows, "m1"), false);
    assert.equal(rows.get("m1")?.status, "sending");
  });

  it("stale sending reclaim restores scheduled for retry", () => {
    const rows = new Map([["m1", { status: "sending" }]]);
    // reclaim
    for (const row of rows.values()) {
      if (row.status === "sending") row.status = "scheduled";
    }
    assert.equal(claim(rows, "m1"), true);
  });
});
