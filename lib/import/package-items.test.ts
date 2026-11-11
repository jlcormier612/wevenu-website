import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parsePackageIncludedItems } from "@/lib/import/package-items";

describe("parsePackageIncludedItems", () => {
  it("parses description|qty|unit entries", () => {
    const r = parsePackageIncludedItems("Toast|50|each; Coord|1|flat");
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.items.length, 2);
    assert.deepEqual(r.items[0], { description: "Toast", quantity: "50", unit: "each" });
    assert.deepEqual(r.items[1], { description: "Coord", quantity: "1", unit: "flat" });
  });

  it("defaults quantity to 1 when omitted", () => {
    const r = parsePackageIncludedItems("Welcome drink");
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.deepEqual(r.items[0], { description: "Welcome drink", quantity: "1", unit: "" });
  });

  it("rejects non-numeric quantities", () => {
    const r = parsePackageIncludedItems("Chairs|many|each");
    assert.equal(r.ok, false);
  });

  it("treats blank as no items", () => {
    const r = parsePackageIncludedItems("  ");
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.items.length, 0);
  });
});
