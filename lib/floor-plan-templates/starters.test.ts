/**
 * Starter Floor Plan Templates — unit tests (node:test).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FLOOR_PLAN_STARTER_MASTERS,
  LEGACY_COMBINED_FLOOR_PLAN_STARTER_KEY,
  getFloorPlanStarterMaster,
  isSameRoomFlipStarter,
  looksLikeLegacyCombinedFloorPlan,
  shouldSkipFloorPlanStarterProvision,
} from "@/lib/floor-plan-templates/starters";

const VENUE_CLAIM_PATTERNS = [
  /\bADA\b/i,
  /fire\s*code/i,
  /occupancy\s*limit/i,
  /exit\s*(door|route|path)/i,
  /capacity\s*(rating|code)/i,
];

const EXPECTED_KEYS = ["FP-03", "FP-04", "FP-02", "FP-SR", "FP-05"] as const;

describe("Starter Floor Plan masters", () => {
  it("ships five distinct starter choices (not the legacy combined default)", () => {
    assert.equal(FLOOR_PLAN_STARTER_MASTERS.length, 5);
    assert.deepEqual(
      FLOOR_PLAN_STARTER_MASTERS.map((m) => m.key),
      [...EXPECTED_KEYS],
    );
    assert.equal(getFloorPlanStarterMaster(LEGACY_COMBINED_FLOOR_PLAN_STARTER_KEY), undefined);
    assert.equal(getFloorPlanStarterMaster("FP-03")!.name, "Wedding Ceremony");
    assert.equal(getFloorPlanStarterMaster("FP-04")!.name, "Cocktail Hour");
    assert.equal(getFloorPlanStarterMaster("FP-02")!.name, "Wedding Reception");
    assert.equal(getFloorPlanStarterMaster("FP-SR")!.name, "Same-Room Ceremony + Reception Flip");
    assert.equal(getFloorPlanStarterMaster("FP-05")!.name, "Blank Floor Plan");
  });

  it("uses clear descriptions; flip does not claim timed phase switching", () => {
    const flip = getFloorPlanStarterMaster("FP-SR")!;
    assert.ok(isSameRoomFlipStarter(flip));
    assert.match(flip.description, /static/i);
    assert.match(flip.description, /does not switch/i);
    assert.doesNotMatch(flip.description, /automatically\s+transitions/i);
    assert.match(getFloorPlanStarterMaster("FP-03")!.description, /ceremony/i);
    assert.match(getFloorPlanStarterMaster("FP-04")!.description, /cocktail|mingling/i);
    assert.match(getFloorPlanStarterMaster("FP-02")!.description, /reception|dining/i);
    assert.match(getFloorPlanStarterMaster("FP-05")!.description, /empty|blank/i);
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

  it("Wedding Ceremony has ceremony elements only — no cocktail or reception dining", () => {
    const ceremony = getFloorPlanStarterMaster("FP-03")!;
    const labels = ceremony.objects.map((o) => (o.label ?? "").toLowerCase());
    assert.ok(labels.some((l) => l.includes("ceremony")));
    assert.ok(ceremony.objects.some((o) => o.displayShape === "arbor"));
    assert.ok(ceremony.objects.some((o) => o.displayShape === "aisle"));
    assert.equal(labels.some((l) => l.includes("cocktail")), false);
    assert.equal(ceremony.objects.some((o) => o.objectType === "dance_floor"), false);
    assert.equal(ceremony.objects.some((o) => o.displayShape === "cocktail"), false);
    assert.equal(labels.some((l) => l.startsWith("t") && /^t\d+$/i.test(l)), false);
  });

  it("Cocktail Hour has high-tops and bar — no ceremony or reception dining layout", () => {
    const cocktail = getFloorPlanStarterMaster("FP-04")!;
    const labels = cocktail.objects.map((o) => (o.label ?? "").toLowerCase());
    assert.ok(labels.some((l) => l.includes("cocktail")));
    assert.ok(cocktail.objects.some((o) => o.displayShape === "cocktail"));
    assert.ok(cocktail.objects.some((o) => o.objectType === "bar"));
    assert.equal(cocktail.objects.some((o) => o.displayShape === "arbor" || o.displayShape === "aisle"), false);
    assert.equal(cocktail.objects.some((o) => o.objectType === "dance_floor"), false);
    assert.equal(labels.some((l) => l.includes("sweetheart")), false);
  });

  it("Wedding Reception is reception-only — no ceremony-specific elements", () => {
    const reception = getFloorPlanStarterMaster("FP-02")!;
    const labels = reception.objects.map((o) => (o.label ?? "").toLowerCase());
    assert.equal(labels.some((l) => l.includes("ceremony")), false);
    assert.equal(reception.objects.some((o) => o.displayShape === "arbor" || o.displayShape === "aisle"), false);
    assert.ok(labels.some((l) => l.includes("reception")));
    assert.ok(reception.objects.some((o) => o.objectType === "dance_floor"));
    assert.ok(reception.objects.some((o) => o.objectType === "bar"));
    assert.ok(labels.some((l) => l.includes("sweetheart")));
    assert.ok(reception.objects.filter((o) => o.objectType === "table_round").length >= 8);
  });

  it("Same-Room Flip is specialized static reference — not a cocktail triple-zone default", () => {
    const flip = getFloorPlanStarterMaster("FP-SR")!;
    const labels = flip.objects.map((o) => (o.label ?? "").toLowerCase());
    assert.ok(labels.some((l) => l.includes("ceremony")));
    assert.ok(labels.some((l) => l.includes("reception")));
    assert.ok(labels.some((l) => l.includes("static") || l.includes("reference")));
    // No dedicated cocktail zone as a third simultaneous wedding requirement
    assert.equal(labels.some((l) => l === "cocktail" || l === "cocktail hour"), false);
    assert.ok(flip.objects.some((o) => o.displayShape === "arbor"));
    assert.ok(flip.objects.some((o) => o.objectType === "dance_floor"));
  });

  it("Blank starter has no prepopulated layout objects", () => {
    const blank = getFloorPlanStarterMaster("FP-05")!;
    assert.equal(blank.objects.length, 0);
  });

  it("does not invent inventory links on starters", () => {
    for (const master of FLOOR_PLAN_STARTER_MASTERS) {
      assert.ok(
        master.objects.every((o) => o.width > 0 && o.height > 0),
        master.key,
      );
    }
  });

  it("detects legacy combined fingerprints without treating new starters as combined", () => {
    assert.equal(
      looksLikeLegacyCombinedFloorPlan(["Ceremony", "Cocktail", "Reception", "T1"]),
      true,
    );
    assert.equal(
      looksLikeLegacyCombinedFloorPlan(
        getFloorPlanStarterMaster("FP-03")!.objects.map((o) => o.label),
      ),
      false,
    );
    assert.equal(
      looksLikeLegacyCombinedFloorPlan(
        getFloorPlanStarterMaster("FP-SR")!.objects.map((o) => o.label),
      ),
      false,
    );
  });
});

describe("Floor Plan starter provision skip rules", () => {
  it("skips when source_master_key already exists (idempotent)", () => {
    assert.equal(
      shouldSkipFloorPlanStarterProvision({
        masterKey: "FP-03",
        masterName: "Wedding Ceremony",
        existingByKey: new Set(["FP-03"]),
        existingNames: new Set(),
      }),
      "skip_key",
    );
  });

  it("skips same-named customized templates (never overwrite)", () => {
    assert.equal(
      shouldSkipFloorPlanStarterProvision({
        masterKey: "FP-03",
        masterName: "Wedding Ceremony",
        existingByKey: new Set(),
        existingNames: new Set(["Wedding Ceremony"]),
      }),
      "skip_name",
    );
  });

  it("creates when key and name are free — including alongside legacy FP-01", () => {
    assert.equal(
      shouldSkipFloorPlanStarterProvision({
        masterKey: "FP-SR",
        masterName: "Same-Room Ceremony + Reception Flip",
        existingByKey: new Set(["FP-01", "FP-02"]),
        existingNames: new Set([
          "Standard Wedding — Ceremony + Reception",
          "Standard Wedding — Reception Only",
        ]),
      }),
      "create",
    );
  });

  it("re-running provision is idempotent once all five keys exist", () => {
    const keys = new Set(EXPECTED_KEYS);
    for (const master of FLOOR_PLAN_STARTER_MASTERS) {
      assert.equal(
        shouldSkipFloorPlanStarterProvision({
          masterKey: master.key,
          masterName: master.name,
          existingByKey: keys,
          existingNames: new Set(FLOOR_PLAN_STARTER_MASTERS.map((m) => m.name)),
        }),
        "skip_key",
      );
    }
  });
});
