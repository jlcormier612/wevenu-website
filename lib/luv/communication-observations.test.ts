/**
 * Aggregate delivery Luv cards are not shown after Health deferred delivery UI.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

const src = readFileSync(resolve("lib/luv/communication-observations.ts"), "utf8");
const service = readFileSync(resolve("lib/dashboard/service.ts"), "utf8");

describe("communication observations — no unsupported delivery summary", () => {
  it("does not emit all-delivered or recent-failures aggregate cards", () => {
    assert.doesNotMatch(src, /comm-all-delivered/);
    assert.doesNotMatch(src, /comm-recent-failures/);
    assert.doesNotMatch(src, /reached its destination/);
    assert.doesNotMatch(src, /couldn't be delivered in the last day/);
    assert.doesNotMatch(src, /actionLabel: "Review/);
    assert.doesNotMatch(src, /kind: "celebration"/);
  });

  it("does not build a recent sent/failed rollup for those removed cards", () => {
    assert.doesNotMatch(src, /failedRecent/);
    assert.doesNotMatch(src, /allRecent/);
    assert.doesNotMatch(src, /conversationRecent/);
    assert.doesNotMatch(src, /legacyRecent/);
  });

  it("keeps actionable stale-unopened observation with Inbox/lead destinations", () => {
    assert.match(src, /comm-stale-unopened-/);
    assert.match(src, /\/leads\/\$\{thread\.lead_id\}/);
    assert.match(src, /link: thread\?\.lead_id \? `\/leads\/\$\{thread\.lead_id\}` : "\/messaging"/);
    assert.doesNotMatch(src, /"\/messaging\/health"/);
  });

  it("dashboard filter no longer admits removed aggregate communication ids", () => {
    assert.doesNotMatch(service, /comm-all-delivered/);
    assert.doesNotMatch(service, /comm-recent-failures/);
    assert.match(service, /comm-stale-unopened-/);
  });
});
