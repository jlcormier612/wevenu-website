/**
 * Flow-review items 7–9 — Floor plans simplify.
 * 7 — simpler Floor Plans area (plain intro; advanced tools collapsed)
 * 8 — “not on the Event Order” flags are informational, not alarming
 * 9 — stock sharing setting is discoverable (above the inventory list)
 *
 * Run: npx tsx --test lib/flow-review/floor-plans-simplify.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { rowSentence } from "@/lib/floor-plans/required-vs-placed";

function read(rel: string) {
  return readFileSync(resolve(rel), "utf8");
}

describe("Floor plans simplify (7–9)", () => {
  it("7 workspace intro and empty state lead with Add a layout", () => {
    const workspace = read("components/events/floor-plan-workspace.tsx");
    const detail = read("components/events/event-detail.tsx");
    assert.match(workspace, /floor-plan-workspace-intro/);
    assert.match(workspace, /floor-plan-selection-status/);
    assert.match(workspace, /floor-plan-offered-layouts/);
    assert.match(workspace, /floor-plan-tool-sheet/);
    assert.doesNotMatch(workspace, /More layout tools \(optional\)/);
    assert.match(workspace, /Most events start with Add a layout here/);
    assert.match(detail, /Arrange furniture for this event/);
    assert.doesNotMatch(detail, /Offer layouts\s+to the client from Event setup/);
  });

  it("8 not-ordered wording is soft and the panel labels extras as fine", () => {
    assert.equal(
      rowSentence({
        key: "t", label: "60\" Round Table", required: 0, placed: 12, status: "not_ordered", isSeats: false,
      }),
      "12 on this layout · not listed on the Event Order",
    );
    assert.doesNotMatch(rowSentence({
      key: "t", label: "x", required: 0, placed: 1, status: "not_ordered", isSeats: false,
    }), /not on the Event Order$/);
    const panel = read("components/floor-plan/floor-plan-required-vs-placed.tsx");
    assert.match(panel, /Also on this layout/);
    assert.match(panel, /Fine when you place tables or décor/);
  });

  it("9 stock sharing sits above the inventory item list with an anchor", () => {
    const page = read("app/(app)/library/inventory/page.tsx");
    const stockIdx = page.indexOf("<StockSharingSetting");
    const listIdx = page.indexOf("<InventoryLibrarySection");
    assert.ok(stockIdx > 0 && listIdx > 0 && stockIdx < listIdx, "StockSharingSetting must precede the item list");
    assert.match(page, /id="stock-sharing"/);
    assert.match(page, /Set when two events can share the same stock/);
  });
});
