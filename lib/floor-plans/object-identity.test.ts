import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  inventoryLinkStatus,
  looksLikePlacementId,
  nextPlacementLabel,
  resolveItemTypeLabel,
  suggestedCapacityForPlacement,
} from "@/lib/floor-plans/object-identity";

describe("object identity — placement vs item type", () => {
  it("treats C1/T6 as placement ids, not item names", () => {
    assert.equal(looksLikePlacementId("C1"), true);
    assert.equal(looksLikePlacementId("T6"), true);
    assert.equal(looksLikePlacementId("Cocktail Table"), false);
    assert.equal(looksLikePlacementId('60" Round Table'), false);
  });

  it("numbers cocktail and round placements with distinct prefixes", () => {
    const existing = [{ label: "C1" }, { label: "C2" }, { label: "T1" }];
    assert.equal(nextPlacementLabel(existing, "cocktail", "table_round"), "C3");
    assert.equal(nextPlacementLabel(existing, "round", "table_round"), "T2");
  });

  it("suggests 4 seats for cocktail and size-based seats for rounds", () => {
    assert.equal(suggestedCapacityForPlacement("cocktail", "table_round", 30), 4);
    assert.equal(suggestedCapacityForPlacement("round", "table_round", 60), 8);
    assert.equal(suggestedCapacityForPlacement("round", "table_round", 72), 10);
  });

  it("resolves item type from inventory, then shape — never from placement id", () => {
    const fromInv = resolveItemTypeLabel(
      { objectType: "table_round", label: "C1", displayShape: "cocktail", inventoryItemId: "inv-1" },
      "Cocktail Table",
    );
    assert.equal(fromInv.source, "inventory");
    assert.equal(fromInv.label, "Cocktail Table");

    const fromShape = resolveItemTypeLabel(
      { objectType: "table_round", label: "C1", displayShape: "cocktail", inventoryItemId: null },
      null,
    );
    assert.equal(fromShape.source, "shape");
    assert.equal(fromShape.label, "Cocktail Table");

    const round = resolveItemTypeLabel(
      { objectType: "table_round", label: "T1", displayShape: "round", inventoryItemId: null },
      null,
    );
    assert.equal(round.label, "Round Table");
    assert.notEqual(fromShape.label, round.label);
  });

  it("reports unlinked honestly without inventing a relationship", () => {
    const s = inventoryLinkStatus(null, null);
    assert.equal(s.kind, "unlinked");
    assert.match(s.summary, /Not linked/);
  });
});
