import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const core = readFileSync(new URL("../clients/service.ts", import.meta.url), "utf8");
const sync = readFileSync(new URL("./import-sync.ts", import.meta.url), "utf8");
const queue = readFileSync(new URL("./queue.ts", import.meta.url), "utf8");

describe("QuickBooks import enqueue policy", () => {
  it("skips automatic customer enqueue on import-origin client create", () => {
    assert.match(core, /if \(!historicalImport && !importAsHistoricalRecord\)/);
    assert.match(core, /enqueueQuickBooksSync\(venueId, "customer"/);
  });

  it("keeps a deliberate post-migration path that requires a venue connection", () => {
    assert.match(sync, /enqueueExistingCustomersForQuickBooks/);
    assert.match(sync, /This venue has not connected QuickBooks/);
    assert.match(sync, /getConnection/);
  });

  it("does not change the native enqueue function signature used by ordinary operations", () => {
    assert.match(queue, /export async function enqueueQuickBooksSync/);
    assert.doesNotMatch(queue, /historicalImport/);
  });
});
