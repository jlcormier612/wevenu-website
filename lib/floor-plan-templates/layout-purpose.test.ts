/**
 * Layout purpose vs booking event_type — Library filter contracts.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { eventTypeLabel } from "@/lib/event-types/canonical";
import {
  FLOOR_PLAN_LAYOUT_PURPOSE_ANY,
  assertStarterLayoutPurposesMapped,
  layoutPurposeFromSourceMasterKey,
  layoutPurposeLabel,
  layoutPurposeLabelForTemplate,
  templateMatchesLayoutPurposeFilter,
} from "@/lib/floor-plan-templates/layout-purpose";
import {
  FLOOR_PLAN_STARTER_MASTERS,
  LEGACY_COMBINED_FLOOR_PLAN_STARTER_KEY,
  getFloorPlanStarterMaster,
} from "@/lib/floor-plan-templates/starters";

describe("floor-plan layout purpose", () => {
  it("maps every current starter master to a layout purpose", () => {
    assert.doesNotThrow(() => assertStarterLayoutPurposesMapped());
    assert.equal(layoutPurposeFromSourceMasterKey("FP-03"), "ceremony");
    assert.equal(layoutPurposeFromSourceMasterKey("FP-04"), "cocktail");
    assert.equal(layoutPurposeFromSourceMasterKey("FP-02"), "reception");
    assert.equal(layoutPurposeFromSourceMasterKey("FP-SR"), "same_room_flip");
    assert.equal(layoutPurposeFromSourceMasterKey("FP-05"), "blank");
    assert.equal(layoutPurposeFromSourceMasterKey(LEGACY_COMBINED_FLOOR_PLAN_STARTER_KEY), "combined");
    assert.equal(layoutPurposeFromSourceMasterKey(null), "custom");
  });

  it("Wedding + Reception Only metadata: FP-02 stays wedding event type with reception layout", () => {
    const master = getFloorPlanStarterMaster("FP-02")!;
    assert.equal(master.eventType, "wedding");
    assert.equal(eventTypeLabel(master.eventType), "Wedding");
    assert.equal(layoutPurposeFromSourceMasterKey(master.key), "reception");
    assert.equal(layoutPurposeLabel("reception"), "Reception Only");
    // Name may be "Wedding Reception" on master; venue copies may keep legacy title.
    assert.match(master.name, /reception/i);
  });

  it("Reception Only layout filter matches FP-02 and not ceremony/cocktail/blank", () => {
    assert.equal(templateMatchesLayoutPurposeFilter("FP-02", "reception"), true);
    assert.equal(templateMatchesLayoutPurposeFilter("FP-03", "reception"), false);
    assert.equal(templateMatchesLayoutPurposeFilter("FP-04", "reception"), false);
    assert.equal(templateMatchesLayoutPurposeFilter("FP-05", "reception"), false);
    assert.equal(templateMatchesLayoutPurposeFilter("FP-SR", "reception"), false);
    assert.equal(templateMatchesLayoutPurposeFilter(null, "reception"), false);
  });

  it("Wedding event-type dimension remains independent of layout purpose", () => {
    for (const master of FLOOR_PLAN_STARTER_MASTERS) {
      assert.equal(master.eventType, "wedding", master.key);
    }
    // Selecting booking event type "reception" must NOT equal layout purpose reception
    // — those are different fields (event_type vs source_master_key).
    assert.notEqual("reception" /* event type value */, "FP-02");
    assert.equal(layoutPurposeFromSourceMasterKey("FP-02"), "reception");
  });

  it("Ceremony, Cocktail, Same-Room Flip, and Blank remain distinguishable", () => {
    const labels = ["FP-03", "FP-04", "FP-SR", "FP-05"].map((k) =>
      layoutPurposeLabelForTemplate(k),
    );
    assert.deepEqual(new Set(labels).size, 4);
    assert.equal(layoutPurposeLabelForTemplate("FP-03"), "Ceremony");
    assert.equal(layoutPurposeLabelForTemplate("FP-04"), "Cocktail Hour");
    assert.equal(layoutPurposeLabelForTemplate("FP-SR"), "Same-Room Flip");
    assert.equal(layoutPurposeLabelForTemplate("FP-05"), "Blank Floor Plan");
  });

  it("All layouts sentinel matches every template", () => {
    assert.equal(templateMatchesLayoutPurposeFilter("FP-02", FLOOR_PLAN_LAYOUT_PURPOSE_ANY), true);
    assert.equal(templateMatchesLayoutPurposeFilter(null, FLOOR_PLAN_LAYOUT_PURPOSE_ANY), true);
    assert.equal(templateMatchesLayoutPurposeFilter("FP-01", FLOOR_PLAN_LAYOUT_PURPOSE_ANY), true);
  });

  it("search compatibility: purpose filter is orthogonal to name matching", () => {
    const rows = [
      { name: "Standard Wedding — Reception Only", sourceMasterKey: "FP-02", eventType: "wedding" },
      { name: "Wedding Ceremony", sourceMasterKey: "FP-03", eventType: "wedding" },
      { name: "Barn-master-floorplan", sourceMasterKey: null, eventType: null },
    ];
    const layoutFiltered = rows.filter((t) =>
      templateMatchesLayoutPurposeFilter(t.sourceMasterKey, "reception"),
    );
    assert.equal(layoutFiltered.length, 1);
    assert.equal(layoutFiltered[0]!.name, "Standard Wedding — Reception Only");

    const search = "reception";
    const both = rows.filter(
      (t) =>
        templateMatchesLayoutPurposeFilter(t.sourceMasterKey, "reception")
        && t.name.toLowerCase().includes(search),
    );
    assert.equal(both.length, 1);

    const weddingEvent = rows.filter((t) => t.eventType === "wedding");
    assert.equal(weddingEvent.length, 2);
  });

  it("custom templates retain custom layout purpose without inventing a starter key", () => {
    assert.equal(layoutPurposeFromSourceMasterKey(null), "custom");
    assert.equal(layoutPurposeLabelForTemplate(null), "Custom layout");
    assert.equal(templateMatchesLayoutPurposeFilter(null, "custom"), true);
    assert.equal(templateMatchesLayoutPurposeFilter("FP-02", "custom"), false);
  });

  it("legacy FP-01 remains combined layout purpose, not reception-only", () => {
    assert.equal(layoutPurposeFromSourceMasterKey("FP-01"), "combined");
    assert.equal(templateMatchesLayoutPurposeFilter("FP-01", "reception"), false);
    assert.equal(templateMatchesLayoutPurposeFilter("FP-01", "combined"), true);
  });
});
