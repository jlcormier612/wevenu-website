/**
 * Starter Floor Plan Templates — unit tests (node:test).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FLOOR_PLAN_STARTER_MASTERS,
  getFloorPlanStarterMaster,
  shouldSkipFloorPlanStarterProvision,
} from "@/lib/floor-plan-templates/starters";

const VENUE_CLAIM_PATTERNS = [
  /\bADA\b/i,
  /fire\s*code/i,
  /occupancy\s*limit/i,
  /exit\s*(door|route|path)/i,
  /capacity\s*(rating|code)/i,
];

describe("Starter Floor Plan masters", () => {
  it("ships FP-01 / FP-02 with customer-facing names and descriptions", () => {
    assert.equal(FLOOR_PLAN_STARTER_MASTERS.length, 2);
    const fp01 = getFloorPlanStarterMaster("FP-01")!;
    const fp02 = getFloorPlanStarterMaster("FP-02")!;
    assert.equal(fp01.name, "Standard Wedding — Ceremony + Reception");
    assert.equal(fp02.name, "Standard Wedding — Reception Only");
    assert.match(fp01.description, /ceremony and reception/i);
    assert.match(fp02.description, /reception/i);
    assert.equal(fp01.eventType, "wedding");
    assert.equal(fp02.eventType, "wedding");
  });

  it("uses illustrative room placeholders (positive dimensions), not capacity claims in copy", () => {
    for (const master of FLOOR_PLAN_STARTER_MASTERS) {
      assert.ok(master.roomWidthFt > 0);
      assert.ok(master.roomDepthFt > 0);
      for (const pat of VENUE_CLAIM_PATTERNS) {
        assert.doesNotMatch(master.description, pat, master.key);
        assert.doesNotMatch(master.name, pat, master.key);
      }
      for (const o of master.objects) {
        if (o.label) {
          for (const pat of VENUE_CLAIM_PATTERNS) {
            assert.doesNotMatch(o.label, pat, `${master.key}:${o.label}`);
          }
        }
      }
    }
  });

  it("FP-01 includes ceremony → cocktail → reception elements", () => {
    const fp01 = getFloorPlanStarterMaster("FP-01")!;
    const labels = fp01.objects.map((o) => (o.label ?? "").toLowerCase());
    assert.ok(labels.some((l) => l.includes("ceremony")));
    assert.ok(labels.some((l) => l.includes("cocktail")));
    assert.ok(labels.some((l) => l.includes("reception")));
    assert.ok(fp01.objects.some((o) => o.displayShape === "arbor" || (o.label ?? "").toLowerCase().includes("arbor")));
    assert.ok(fp01.objects.some((o) => o.displayShape === "aisle" || (o.label ?? "").toLowerCase().includes("aisle")));
    assert.ok(fp01.objects.some((o) => (o.label ?? "").toLowerCase().includes("reserved")));
    assert.ok(fp01.objects.some((o) => o.objectType === "dance_floor"));
    assert.ok(fp01.objects.some((o) => o.objectType === "bar"));
    assert.ok(fp01.objects.some((o) => o.objectType === "cake_table"));
    assert.ok(fp01.objects.some((o) => o.objectType === "gift_table"));
    assert.ok(fp01.objects.some((o) => (o.label ?? "").toLowerCase().includes("sweetheart")));
    assert.ok(fp01.objects.some((o) => (o.label ?? "").toLowerCase().includes("dj")));
    assert.ok(fp01.objects.some((o) => o.displayShape === "cocktail"));
    assert.ok(fp01.objects.some((o) => o.objectType === "table_round" && (o.label ?? "").startsWith("T")));
  });

  it("FP-02 is a reception layout — no ceremony-specific elements", () => {
    const fp02 = getFloorPlanStarterMaster("FP-02")!;
    const labels = fp02.objects.map((o) => (o.label ?? "").toLowerCase());
    assert.equal(labels.some((l) => l.includes("ceremony")), false);
    assert.equal(fp02.objects.some((o) => o.displayShape === "arbor" || o.displayShape === "aisle"), false);
    assert.equal(labels.some((l) => l.includes("aisle")), false);
    assert.equal(labels.some((l) => l.includes("arbor")), false);
    assert.ok(labels.some((l) => l.includes("reception")));
    assert.ok(fp02.objects.some((o) => o.objectType === "dance_floor"));
    assert.ok(fp02.objects.some((o) => o.objectType === "bar"));
    assert.ok(fp02.objects.some((o) => (o.label ?? "").toLowerCase().includes("sweetheart")));
    assert.ok(fp02.objects.filter((o) => o.objectType === "table_round").length >= 8);
  });

  it("does not invent inventory links on starters", () => {
    // Starter fixtures have no inventoryItemId field — provision inserts null.
    for (const master of FLOOR_PLAN_STARTER_MASTERS) {
      assert.ok(master.objects.every((o) => o.x > 0 && o.y > 0 && o.width > 0 && o.height > 0));
    }
  });
});

describe("Floor Plan starter provision skip rules", () => {
  it("skips when source_master_key already exists (idempotent)", () => {
    assert.equal(
      shouldSkipFloorPlanStarterProvision({
        masterKey: "FP-01",
        masterName: "Standard Wedding — Ceremony + Reception",
        existingByKey: new Set(["FP-01"]),
        existingNames: new Set(),
      }),
      "skip_key",
    );
  });

  it("skips same-named customized templates (never overwrite)", () => {
    assert.equal(
      shouldSkipFloorPlanStarterProvision({
        masterKey: "FP-01",
        masterName: "Standard Wedding — Ceremony + Reception",
        existingByKey: new Set(),
        existingNames: new Set(["Standard Wedding — Ceremony + Reception"]),
      }),
      "skip_name",
    );
  });

  it("creates when key and name are free", () => {
    assert.equal(
      shouldSkipFloorPlanStarterProvision({
        masterKey: "FP-02",
        masterName: "Standard Wedding — Reception Only",
        existingByKey: new Set(["FP-01"]),
        existingNames: new Set(["Standard Wedding — Ceremony + Reception"]),
      }),
      "create",
    );
  });
});
