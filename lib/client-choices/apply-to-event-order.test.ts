import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  financialDeltaFromLines,
  isPriceNeutralChange,
  resolveSelectedOptions,
} from "@/lib/client-choices/apply-to-event-order";
import type { ChoicesDefinition } from "@/lib/client-choices/types";

const definition: ChoicesDefinition = {
  sections: [{ id: "s1", name: "Dinner", guidance: null, sortOrder: 0 }],
  groups: [{
    id: "g1",
    sectionId: "s1",
    name: "Entrée",
    instructions: null,
    selectionMode: "single",
    minSelect: 1,
    maxSelect: 1,
    allowQuantity: false,
    sortOrder: 0,
  }, {
    id: "g2",
    sectionId: "s1",
    name: "Add-ons",
    instructions: null,
    selectionMode: "multi",
    minSelect: 0,
    maxSelect: null,
    allowQuantity: false,
    sortOrder: 1,
  }],
  options: [
    {
      id: "o-chicken", groupId: "g1", offeringId: "off-1", label: "Chicken",
      description: null, isIncluded: true, unitPrice: 0, sortOrder: 0,
    },
    {
      id: "o-salmon", groupId: "g1", offeringId: "off-2", label: "Salmon",
      description: null, isIncluded: true, unitPrice: 0, sortOrder: 1,
    },
    {
      id: "o-snack", groupId: "g2", offeringId: "off-3", label: "Late Night Snack",
      description: null, isIncluded: false, unitPrice: 750, sortOrder: 0,
    },
    {
      id: "o-linen", groupId: "g2", offeringId: null, label: "Premium Linen",
      description: null, isIncluded: false, unitPrice: 400, sortOrder: 1,
    },
  ],
};

describe("resolveSelectedOptions / financial delta", () => {
  it("price-neutral included swap has $0 delta", () => {
    const chicken = resolveSelectedOptions(definition, { g1: { optionIds: ["o-chicken"] } });
    const salmon = resolveSelectedOptions(definition, { g1: { optionIds: ["o-salmon"] } });
    assert.equal(financialDeltaFromLines(chicken), 0);
    assert.equal(financialDeltaFromLines(salmon), 0);
    assert.equal(isPriceNeutralChange(0, 0), true);
    assert.equal(salmon[0]?.description, "Salmon");
  });

  it("add-on produces financial delta", () => {
    const lines = resolveSelectedOptions(definition, {
      g1: { optionIds: ["o-salmon"] },
      g2: { optionIds: ["o-snack"] },
    });
    assert.equal(financialDeltaFromLines(lines), 750);
  });

  it("multiple add-ons sum", () => {
    const lines = resolveSelectedOptions(definition, {
      g2: { optionIds: ["o-snack", "o-linen"] },
    });
    assert.equal(financialDeltaFromLines(lines), 1150);
  });
});
