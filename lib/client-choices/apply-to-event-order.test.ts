import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  conflictingSingleSelectLineIds,
  duplicateMultiSelectLineIds,
  financialDeltaFromLines,
  isPriceNeutralChange,
  resolveSelectedOptions,
} from "@/lib/client-choices/apply-to-event-order";
import type { ChoicesAnswers, ChoicesDefinition } from "@/lib/client-choices/types";

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

describe("conflictingSingleSelectLineIds", () => {
  it("clears all option labels in an answered single-select group", () => {
    const answers: ChoicesAnswers = { g1: { optionIds: ["o-salmon"] } };
    const ids = conflictingSingleSelectLineIds({
      definition,
      answers,
      eventOrderLines: [
        { id: "legacy-chicken", description: "Chicken" },
        { id: "legacy-salmon", description: "Salmon" },
        { id: "arbor", description: "Arbor" },
        { id: "snack", description: "Late Night Snack" },
      ],
    });
    assert.deepEqual(ids.sort(), ["legacy-chicken", "legacy-salmon"].sort());
  });

  it("does not clear multi-select option labels when only single-select is answered", () => {
    const answers: ChoicesAnswers = { g1: { optionIds: ["o-chicken"] } };
    const ids = conflictingSingleSelectLineIds({
      definition,
      answers,
      eventOrderLines: [
        { id: "snack", description: "Late Night Snack" },
        { id: "chicken", description: "Chicken" },
      ],
      alreadyRemovingIds: ["chicken"],
    });
    assert.deepEqual(ids, []);
  });

  it("ignores single-select groups with no answer", () => {
    const answers: ChoicesAnswers = { g2: { optionIds: ["o-snack"] } };
    const ids = conflictingSingleSelectLineIds({
      definition,
      answers,
      eventOrderLines: [
        { id: "chicken", description: "Chicken" },
        { id: "salmon", description: "Salmon" },
      ],
    });
    assert.deepEqual(ids, []);
  });
});

describe("duplicateMultiSelectLineIds", () => {
  const sectionIdByGroup = new Map([["g1", "eo-dinner"], ["g2", "eo-dinner"]]);

  it("a selected add-on already on the Event Order in the same section is replaced, not added twice", () => {
    const ids = duplicateMultiSelectLineIds({
      definition,
      answers: { g2: { optionIds: ["o-linen"] } },
      eventOrderLines: [
        { id: "legacy-linen", description: "  premium   linen ", sectionId: "eo-dinner" },
        { id: "other-section-linen", description: "Premium Linen", sectionId: "eo-rentals" },
        { id: "snack", description: "Late Night Snack", sectionId: "eo-dinner" },
      ],
      sectionIdByGroup,
    });
    assert.deepEqual(ids, ["legacy-linen"]);
  });

  it("unselected or empty pick-any answers never remove venue lines", () => {
    const lines = [
      { id: "linen", description: "Premium Linen", sectionId: "eo-dinner" },
      { id: "snack", description: "Late Night Snack", sectionId: "eo-dinner" },
    ];
    assert.deepEqual(duplicateMultiSelectLineIds({ definition, answers: {}, eventOrderLines: lines, sectionIdByGroup }), []);
    assert.deepEqual(duplicateMultiSelectLineIds({
      definition, answers: { g2: { optionIds: ["o-snack"] } }, eventOrderLines: lines, sectionIdByGroup,
    }), ["snack"]);
  });

  it("the shared apply engine removes duplicates before inserting the couple's lines", () => {
    const core = readFileSync(join(process.cwd(), "lib/client-choices/apply-core.ts"), "utf8");
    const dup = core.indexOf("duplicateMultiSelectLineIds({");
    assert.ok(dup > core.indexOf("conflictingSingleSelectLineIds({"));
    assert.ok(dup < core.indexOf("insertCustomLine("));
  });

  it("pick-one groups and lines already being removed are left to the existing paths", () => {
    const ids = duplicateMultiSelectLineIds({
      definition,
      answers: { g1: { optionIds: ["o-salmon"] }, g2: { optionIds: ["o-snack"] } },
      eventOrderLines: [
        { id: "salmon", description: "Salmon", sectionId: "eo-dinner" },
        { id: "prior-snack", description: "Late Night Snack", sectionId: "eo-dinner" },
      ],
      sectionIdByGroup,
      alreadyRemovingIds: ["prior-snack"],
    });
    assert.deepEqual(ids, []);
  });
});
