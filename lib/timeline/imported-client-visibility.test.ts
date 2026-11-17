import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  selectStaffVisibleImportedClientEntries,
  submittedTimelineIds,
} from "@/lib/timeline/imported-client-visibility";

describe("imported client timeline visibility", () => {
  const imported = {
    id: "client-1",
    owner: "client",
    sourceSpaceUseKey: null,
    notes: "Client wrote this\n[migration:pd-tl-client]",
  };

  it("shows an imported client row that was not submitted", () => {
    const visible = selectStaffVisibleImportedClientEntries([imported], new Set());
    assert.deepEqual(visible.map((row) => row.id), ["client-1"]);
  });

  it("keeps submitted client work on the shared timeline only", () => {
    const visible = selectStaffVisibleImportedClientEntries([imported], submittedTimelineIds([{ id: "client-1" }]));
    assert.equal(visible.length, 0);
  });

  it("does not surface a venue row, a schedule row, or an unsubmitted client draft", () => {
    const visible = selectStaffVisibleImportedClientEntries([
      { id: "venue", owner: "venue", sourceSpaceUseKey: null, notes: "[migration:x]" },
      { id: "schedule", owner: "client", sourceSpaceUseKey: "migration:sched", notes: "[migration:y]" },
      { id: "draft", owner: "client", sourceSpaceUseKey: null, notes: "Private draft" },
    ], new Set());
    assert.equal(visible.length, 0);
  });

  it("does not add imported client rows to the shared timeline read", () => {
    const repo = readFileSync(new URL("./repository.ts", import.meta.url), "utf8");
    const start = repo.indexOf("export async function getTimelineEntries");
    const body = repo.slice(start, repo.indexOf("export async function insertEntry"));
    assert.match(body, /get_event_timeline_merged/);
    assert.doesNotMatch(body, /selectStaffVisibleImportedClientEntries/);
    const sync = readFileSync(new URL("./schedule-sync.ts", import.meta.url), "utf8");
    assert.doesNotMatch(sync, /imported-client-visibility/);
  });
});
