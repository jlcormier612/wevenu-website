import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  inactiveAnsweredOptionIds,
  isChoiceGroupActive,
  orderedVisibleChoiceGroups,
  reconcileAnswersForDependencies,
} from "@/lib/client-choices/conditional-groups";
import { resolveSelectedOptions } from "@/lib/client-choices/apply-to-event-order";
import { validateChoicesAnswers } from "@/lib/client-choices/validate-answers";
import type { ChoicesDefinition } from "@/lib/client-choices/types";

const definition: ChoicesDefinition = {
  sections: [],
  groups: [
    {
      id: "g-dinner",
      sectionId: null,
      name: "Dinner service",
      instructions: null,
      selectionMode: "single",
      minSelect: 1,
      maxSelect: 1,
      allowQuantity: false,
      sortOrder: 0,
    },
    {
      id: "g-plated",
      sectionId: null,
      name: "Plated dinner details",
      instructions: null,
      selectionMode: "single",
      minSelect: 1,
      maxSelect: 1,
      allowQuantity: false,
      sortOrder: 1,
      dependsOnOptionIds: ["o-plated"],
    },
    {
      id: "g-buffet",
      sectionId: null,
      name: "Buffet dinner details",
      instructions: null,
      selectionMode: "single",
      minSelect: 1,
      maxSelect: 1,
      allowQuantity: false,
      sortOrder: 2,
      dependsOnOptionIds: ["o-buffet"],
    },
    {
      id: "g-bar",
      sectionId: null,
      name: "Bar package",
      instructions: null,
      selectionMode: "single",
      minSelect: 0,
      maxSelect: 1,
      allowQuantity: false,
      sortOrder: 3,
    },
    {
      id: "g-beer",
      sectionId: null,
      name: "Beer & Wine details",
      instructions: null,
      selectionMode: "multi",
      minSelect: 0,
      maxSelect: null,
      allowQuantity: false,
      sortOrder: 4,
      dependsOnOptionIds: ["o-beer"],
    },
  ],
  options: [
    {
      id: "o-plated", groupId: "g-dinner", offeringId: null, label: "Plated Dinner",
      description: null, isIncluded: false, unitPrice: 85, sortOrder: 0,
    },
    {
      id: "o-buffet", groupId: "g-dinner", offeringId: null, label: "Buffet Dinner",
      description: null, isIncluded: false, unitPrice: 72, sortOrder: 1,
    },
    {
      id: "o-plated-a", groupId: "g-plated", offeringId: null, label: "Fixture Plated A",
      description: null, isIncluded: false, unitPrice: 10, sortOrder: 0,
    },
    {
      id: "o-buffet-a", groupId: "g-buffet", offeringId: null, label: "Fixture Buffet A",
      description: null, isIncluded: false, unitPrice: 8, sortOrder: 0,
    },
    {
      id: "o-beer", groupId: "g-bar", offeringId: null, label: "Beer & Wine",
      description: null, isIncluded: false, unitPrice: 28, sortOrder: 0,
    },
    {
      id: "o-beer-add", groupId: "g-beer", offeringId: null, label: "Fixture Beer Add-on",
      description: null, isIncluded: false, unitPrice: 5, sortOrder: 0,
    },
  ],
};

describe("conditional choice groups", () => {
  it("1. required parent cannot be skipped", () => {
    const result = validateChoicesAnswers(definition, {});
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /Dinner service/);
  });

  it("2. Plated reveals only plated child groups", () => {
    const answers = { "g-dinner": { optionIds: ["o-plated"] } };
    const visible = orderedVisibleChoiceGroups(definition, answers).map((g) => g.id);
    assert.ok(visible.includes("g-plated"));
    assert.ok(!visible.includes("g-buffet"));
    assert.equal(isChoiceGroupActive(definition.groups[1]!, answers), true);
    assert.equal(isChoiceGroupActive(definition.groups[2]!, answers), false);
  });

  it("3. Buffet reveals only buffet child groups", () => {
    const answers = { "g-dinner": { optionIds: ["o-buffet"] } };
    const visible = orderedVisibleChoiceGroups(definition, answers).map((g) => g.id);
    assert.ok(visible.includes("g-buffet"));
    assert.ok(!visible.includes("g-plated"));
  });

  it("4. switching Plated → Buffet deactivates plated-only selections", () => {
    const before = {
      "g-dinner": { optionIds: ["o-plated"] },
      "g-plated": { optionIds: ["o-plated-a"] },
    };
    const afterSwitch = {
      "g-dinner": { optionIds: ["o-buffet"] },
      "g-plated": { optionIds: ["o-plated-a"] },
    };
    const reconciled = reconcileAnswersForDependencies(definition, afterSwitch);
    assert.deepEqual(reconciled["g-dinner"]?.optionIds, ["o-buffet"]);
    assert.equal(reconciled["g-plated"], undefined);
    assert.deepEqual(inactiveAnsweredOptionIds(definition, afterSwitch), ["o-plated-a"]);
    void before;
  });

  it("5. switching Buffet → Plated deactivates buffet-only selections", () => {
    const afterSwitch = {
      "g-dinner": { optionIds: ["o-plated"] },
      "g-buffet": { optionIds: ["o-buffet-a"] },
    };
    const reconciled = reconcileAnswersForDependencies(definition, afterSwitch);
    assert.equal(reconciled["g-buffet"], undefined);
  });

  it("6. inactive children cannot remain billable", () => {
    const lines = resolveSelectedOptions(definition, {
      "g-dinner": { optionIds: ["o-plated"] },
      "g-plated": { optionIds: ["o-plated-a"] },
      "g-buffet": { optionIds: ["o-buffet-a"] },
    });
    assert.deepEqual(
      lines.map((l) => l.description).sort(),
      ["Fixture Plated A", "Plated Dinner"].sort(),
    );
    assert.ok(!lines.some((l) => l.description === "Fixture Buffet A"));
  });

  it("7. Bar parent/child behaves equivalently", () => {
    const withBar = {
      "g-dinner": { optionIds: ["o-plated"] },
      "g-plated": { optionIds: ["o-plated-a"] },
      "g-bar": { optionIds: ["o-beer"] },
      "g-beer": { optionIds: ["o-beer-add"] },
    };
    assert.ok(orderedVisibleChoiceGroups(definition, withBar).some((g) => g.id === "g-beer"));
    const withoutBar = reconcileAnswersForDependencies(definition, {
      "g-dinner": { optionIds: ["o-plated"] },
      "g-plated": { optionIds: ["o-plated-a"] },
      "g-beer": { optionIds: ["o-beer-add"] },
    });
    assert.equal(withoutBar["g-beer"], undefined);
  });

  it("8. parent + child prices are not double-counted beyond selected lines", () => {
    const lines = resolveSelectedOptions(definition, {
      "g-dinner": { optionIds: ["o-plated"] },
      "g-plated": { optionIds: ["o-plated-a"] },
    });
    const total = lines.reduce((s, l) => s + l.amount, 0);
    assert.equal(total, 95);
  });

  it("9. required child blocks submit when active and unanswered", () => {
    const result = validateChoicesAnswers(definition, {
      "g-dinner": { optionIds: ["o-plated"] },
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /Plated dinner details/);
  });

  it("10. hidden required child does not block submit", () => {
    const result = validateChoicesAnswers(definition, {
      "g-dinner": { optionIds: ["o-buffet"] },
      "g-buffet": { optionIds: ["o-buffet-a"] },
    });
    assert.equal(result.ok, true);
  });

  it("11. orphan answers on inactive children are rejected without reconcile", () => {
    const result = validateChoicesAnswers(definition, {
      "g-dinner": { optionIds: ["o-plated"] },
      "g-plated": { optionIds: ["o-plated-a"] },
      "g-buffet": { optionIds: ["o-buffet-a"] },
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /not available/);
  });

  it("12. nested children render immediately after parent in visible order", () => {
    const visible = orderedVisibleChoiceGroups(definition, {
      "g-dinner": { optionIds: ["o-plated"] },
      "g-plated": { optionIds: ["o-plated-a"] },
      "g-bar": { optionIds: ["o-beer"] },
    }).map((g) => g.id);
    const dinnerIdx = visible.indexOf("g-dinner");
    const platedIdx = visible.indexOf("g-plated");
    assert.equal(platedIdx, dinnerIdx + 1);
  });
});
