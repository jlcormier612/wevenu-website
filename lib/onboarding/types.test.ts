/**
 * Unit tests for onboarding intake choice helpers (no DB).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BRING_BUSINESS_OPTIONS,
  INQUIRY_SOURCE_OPTIONS,
  bringBusinessMigrationHref,
} from "./types";

describe("onboarding intake customer-facing choices", () => {
  it("exposes exactly four bring-business choices", () => {
    assert.equal(BRING_BUSINESS_OPTIONS.length, 4);
    assert.deepEqual(
      BRING_BUSINESS_OPTIONS.map((o) => o.key),
      ["honeybook", "tripleseat", "another_system", "starting_fresh"],
    );
  });

  it("does not expose Planning Pod, spreadsheet, Weven, Knot, or not sure", () => {
    const blob = BRING_BUSINESS_OPTIONS.map((o) => `${o.title} ${o.description}`).join(" ");
    for (const forbidden of [
      "Planning Pod",
      "Spreadsheet",
      "Weven",
      "The Knot",
      "WeddingWire",
      "unsupported",
      "not sure",
      "Not sure",
    ]) {
      assert.equal(blob.toLowerCase().includes(forbidden.toLowerCase()), false, forbidden);
    }
  });

  it("maps bring-business choices to migration routes", () => {
    assert.equal(bringBusinessMigrationHref("starting_fresh"), null);
    assert.match(bringBusinessMigrationHref("honeybook")!, /honeybook/);
    assert.match(bringBusinessMigrationHref("tripleseat")!, /tripleseat/);
    assert.match(bringBusinessMigrationHref("another_system")!, /another_system/);
  });

  it("exposes inquiry sources without A mix of these", () => {
    const labels = INQUIRY_SOURCE_OPTIONS.map((o) => o.label);
    assert.ok(!labels.some((l) => /mix of these/i.test(l)));
    assert.ok(labels.includes("Website"));
    assert.ok(labels.includes("Other"));
  });
});
