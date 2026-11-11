/**
 * Inventory template starters use the same Edit label as venue-owned templates.
 * Customize remains the separate "make a venue-owned copy" action.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Inventory template starter Edit label", () => {
  const list = readFileSync(resolve("components/event-inventory/inventory-template-list.tsx"), "utf8");

  it("starters expose Customize plus Edit (not Edit activities)", () => {
    assert.match(list, /LIBRARY_LABELS\.customize/);
    assert.match(list, /LIBRARY_LABELS\.edit/);
    assert.doesNotMatch(list, /LIBRARY_LABELS\.editActivities/);
  });

  it("starter Edit and venue-owned Edit share the same template detail href", () => {
    const hrefMatches = list.match(/href: `\/library\/inventory-templates\/\$\{template\.id\}`/g) ?? [];
    assert.ok(hrefMatches.length >= 2, `expected shared detail href on starter + owned paths, got ${hrefMatches.length}`);
  });
});
