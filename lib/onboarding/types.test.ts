/**
 * Unit tests for onboarding intake choice helpers (no DB).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BRING_BUSINESS_OPTIONS,
  INQUIRY_SOURCE_OPTIONS,
  bringBusinessIntakeHeading,
  bringBusinessMigrationHref,
} from "./types";

describe("onboarding intake customer-facing choices", () => {
  it("exposes customer-facing bring-business choices without named systems", () => {
    assert.equal(BRING_BUSINESS_OPTIONS.length, 2);
    assert.deepEqual(
      BRING_BUSINESS_OPTIONS.map((o) => o.key),
      ["another_system", "starting_fresh"],
    );
    const blob = BRING_BUSINESS_OPTIONS.map((o) => `${o.title} ${o.description}`).join(" ");
    assert.doesNotMatch(blob, /HoneyBook|Tripleseat/i);
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

  it("keeps bring-business copy warm without promising automatic migration", () => {
    const byKey = Object.fromEntries(
      BRING_BUSINESS_OPTIONS.map((o) => [o.key, o.description]),
    );
    assert.match(byKey.another_system, /exported from your current software/i);
    assert.match(byKey.another_system, /match your information/i);
    for (const text of Object.values(byKey)) {
      assert.equal(/automatic(ally)? migrate|imports? automatically from this answer alone/i.test(text), false);
    }
  });

  it("maps bring-business choices to migration routes", () => {
    assert.equal(bringBusinessMigrationHref("starting_fresh"), null);
    assert.match(bringBusinessMigrationHref("honeybook")!, /bring-your-business/);
    assert.match(bringBusinessMigrationHref("tripleseat")!, /bring-your-business/);
    assert.match(bringBusinessMigrationHref("another_system")!, /bring-your-business/);
  });

  it("echoes the intake Bring Business answer without inventing a new source of truth", () => {
    assert.equal(
      bringBusinessIntakeHeading("honeybook"),
      "Bring your existing business into Hello to Cheers",
    );
    assert.equal(
      bringBusinessIntakeHeading("tripleseat"),
      "Bring your existing business into Hello to Cheers",
    );
    assert.equal(
      bringBusinessIntakeHeading("another_system"),
      "Bring your existing business into Hello to Cheers",
    );
    assert.equal(bringBusinessIntakeHeading("starting_fresh"), "Start fresh");
    assert.equal(bringBusinessIntakeHeading(null), null);
  });

  it("exposes inquiry sources without A mix of these", () => {
    const labels = INQUIRY_SOURCE_OPTIONS.map((o) => o.label);
    assert.ok(!labels.some((l) => /mix of these/i.test(l)));
    assert.ok(labels.includes("Website"));
    assert.ok(labels.includes("Other"));
  });
});
