import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compactFloorPlanLabel,
  isSeatingDestinationType,
  resolveDisplayShape,
} from "@/lib/floor-plans/resolve-display-shape";

describe("resolveDisplayShape", () => {
  it("honors an explicit display_shape", () => {
    assert.equal(
      resolveDisplayShape({ displayShape: "cocktail", objectType: "table_round", width: 42, height: 42 }),
      "cocktail",
    );
  });

  it("does not render ceremony rows as giant rounds when display_shape is null", () => {
    assert.equal(
      resolveDisplayShape({
        displayShape: null,
        objectType: "table_rect",
        width: 100,
        height: 28,
        label: "Ceremony Row 1",
      }),
      "rectangular",
    );
  });

  it("maps table_round with null shape to round", () => {
    assert.equal(
      resolveDisplayShape({ displayShape: null, objectType: "table_round", width: 72, height: 72, label: "T1" }),
      "round",
    );
  });

  it("maps dance_floor / bar object types", () => {
    assert.equal(resolveDisplayShape({ objectType: "dance_floor", width: 160, height: 120 }), "dance_floor");
    assert.equal(resolveDisplayShape({ objectType: "bar", width: 100, height: 44 }), "bar");
  });

  it("falls back to rectangular for strongly non-square unknown objects", () => {
    assert.equal(
      resolveDisplayShape({ displayShape: null, objectType: null, width: 100, height: 28 }),
      "rectangular",
    );
  });
});

describe("compactFloorPlanLabel", () => {
  it("shortens ceremony rows", () => {
    assert.equal(compactFloorPlanLabel("Ceremony Row 1"), "Row 1");
    assert.equal(compactFloorPlanLabel("Sweetheart"), "Sweetheart Table");
    assert.equal(compactFloorPlanLabel("Dance Floor"), "Dance Floor");
    assert.equal(compactFloorPlanLabel("T4"), "T4");
  });
});

describe("isSeatingDestinationType", () => {
  it("only marks genuine seating table types", () => {
    assert.equal(isSeatingDestinationType("table_round"), true);
    assert.equal(isSeatingDestinationType("table_rect"), true);
    assert.equal(isSeatingDestinationType("dance_floor"), false);
    assert.equal(isSeatingDestinationType("bar"), false);
  });
});
