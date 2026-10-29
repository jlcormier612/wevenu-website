import assert from "node:assert/strict";
import { describe, it } from "node:test";

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
      id: "g-arbor",
      sectionId: null,
      name: "Ceremony enhancements",
      instructions: null,
      selectionMode: "multi",
      minSelect: 0,
      maxSelect: null,
      allowQuantity: false,
      sortOrder: 1,
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
      id: "o-arbor", groupId: "g-arbor", offeringId: null, label: "Arbor",
      description: null, isIncluded: false, unitPrice: 350, sortOrder: 0,
    },
  ],
};

describe("validateChoicesAnswers", () => {
  it("rejects submit with no dinner selection", () => {
    const result = validateChoicesAnswers(definition, {});
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /Dinner service/);
  });

  it("rejects two dinners in a pick-one group", () => {
    const result = validateChoicesAnswers(definition, {
      "g-dinner": { optionIds: ["o-plated", "o-buffet"] },
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /only one/);
  });

  it("allows dinner only (arbor optional declined)", () => {
    const result = validateChoicesAnswers(definition, {
      "g-dinner": { optionIds: ["o-plated"] },
    });
    assert.equal(result.ok, true);
  });

  it("allows dinner + arbor", () => {
    const result = validateChoicesAnswers(definition, {
      "g-dinner": { optionIds: ["o-buffet"] },
      "g-arbor": { optionIds: ["o-arbor"] },
    });
    assert.equal(result.ok, true);
  });

  it("rejects unknown option ids", () => {
    const result = validateChoicesAnswers(definition, {
      "g-dinner": { optionIds: ["not-a-real-option"] },
    });
    assert.equal(result.ok, false);
  });

  it("rejects below multi minimum with actionable message", () => {
    const multiMin: ChoicesDefinition = {
      ...definition,
      groups: [
        {
          id: "g-sides",
          sectionId: null,
          name: "Side dishes",
          instructions: null,
          selectionMode: "multi",
          minSelect: 2,
          maxSelect: 2,
          allowQuantity: false,
          sortOrder: 0,
        },
      ],
      options: [
        {
          id: "o-a", groupId: "g-sides", offeringId: null, label: "A",
          description: null, isIncluded: false, unitPrice: 0, sortOrder: 0,
        },
        {
          id: "o-b", groupId: "g-sides", offeringId: null, label: "B",
          description: null, isIncluded: false, unitPrice: 0, sortOrder: 1,
        },
        {
          id: "o-c", groupId: "g-sides", offeringId: null, label: "C",
          description: null, isIncluded: false, unitPrice: 0, sortOrder: 2,
        },
      ],
    };
    const below = validateChoicesAnswers(multiMin, { "g-sides": { optionIds: ["o-a"] } });
    assert.equal(below.ok, false);
    if (!below.ok) assert.match(below.message, /at least 2/);
  });

  it("rejects above multi maximum with actionable message", () => {
    const multiMax: ChoicesDefinition = {
      ...definition,
      groups: [
        {
          id: "g-sides",
          sectionId: null,
          name: "Side dishes",
          instructions: null,
          selectionMode: "multi",
          minSelect: 0,
          maxSelect: 2,
          allowQuantity: false,
          sortOrder: 0,
        },
      ],
      options: [
        {
          id: "o-a", groupId: "g-sides", offeringId: null, label: "A",
          description: null, isIncluded: false, unitPrice: 0, sortOrder: 0,
        },
        {
          id: "o-b", groupId: "g-sides", offeringId: null, label: "B",
          description: null, isIncluded: false, unitPrice: 0, sortOrder: 1,
        },
        {
          id: "o-c", groupId: "g-sides", offeringId: null, label: "C",
          description: null, isIncluded: false, unitPrice: 0, sortOrder: 2,
        },
      ],
    };
    const above = validateChoicesAnswers(multiMax, {
      "g-sides": { optionIds: ["o-a", "o-b", "o-c"] },
    });
    assert.equal(above.ok, false);
    if (!above.ok) assert.match(above.message, /at most 2/);
  });

  it("optional exact-count groups allow skip or exact N, not partial", () => {
    const optionalExact: ChoicesDefinition = {
      ...definition,
      groups: [
        {
          id: "g-spirits",
          sectionId: null,
          name: "Spirits",
          instructions: null,
          selectionMode: "multi",
          minSelect: 0,
          maxSelect: 2,
          allowQuantity: false,
          sortOrder: 0,
        },
      ],
      options: [
        {
          id: "o-a", groupId: "g-spirits", offeringId: null, label: "A",
          description: null, isIncluded: false, unitPrice: 0, sortOrder: 0,
        },
        {
          id: "o-b", groupId: "g-spirits", offeringId: null, label: "B",
          description: null, isIncluded: false, unitPrice: 0, sortOrder: 1,
        },
        {
          id: "o-c", groupId: "g-spirits", offeringId: null, label: "C",
          description: null, isIncluded: false, unitPrice: 0, sortOrder: 2,
        },
      ],
    };
    assert.equal(validateChoicesAnswers(optionalExact, {}).ok, true);
    assert.equal(
      validateChoicesAnswers(optionalExact, {
        "g-spirits": { optionIds: ["o-a", "o-b"] },
      }).ok,
      true,
    );
    const partial = validateChoicesAnswers(optionalExact, {
      "g-spirits": { optionIds: ["o-a"] },
    });
    assert.equal(partial.ok, false);
    if (!partial.ok) assert.match(partial.message, /exactly 2|skip/i);
  });

  it("rejects child answers under an unselected parent for plated vs buffet", () => {
    const dinner: ChoicesDefinition = {
      sections: [],
      groups: [
        {
          id: "g-dinner",
          sectionId: null,
          name: "Dinner style",
          instructions: "Choose one dinner style: Plated Dinner or Buffet Style Dinner.",
          selectionMode: "single",
          minSelect: 1,
          maxSelect: 1,
          allowQuantity: false,
          sortOrder: 0,
        },
        {
          id: "g-plated-entrees",
          sectionId: null,
          name: "Entrées",
          instructions: null,
          selectionMode: "single",
          minSelect: 1,
          maxSelect: 1,
          allowQuantity: false,
          sortOrder: 1,
          dependsOnOptionIds: ["o-plated"],
        },
        {
          id: "g-buffet-sides",
          sectionId: null,
          name: "Buffet sides",
          instructions: null,
          selectionMode: "multi",
          minSelect: 2,
          maxSelect: 2,
          allowQuantity: false,
          sortOrder: 2,
          dependsOnOptionIds: ["o-buffet"],
        },
      ],
      options: [
        {
          id: "o-plated", groupId: "g-dinner", offeringId: "off-plated", label: "Plated Dinner",
          description: null, isIncluded: true, unitPrice: 0, sortOrder: 0,
        },
        {
          id: "o-buffet", groupId: "g-dinner", offeringId: "off-buffet", label: "Buffet Style Dinner",
          description: null, isIncluded: true, unitPrice: 0, sortOrder: 1,
        },
        {
          id: "o-entree", groupId: "g-plated-entrees", offeringId: null, label: "Chicken",
          description: null, isIncluded: true, unitPrice: 0, sortOrder: 0,
        },
        {
          id: "o-side-a", groupId: "g-buffet-sides", offeringId: null, label: "Salad",
          description: null, isIncluded: true, unitPrice: 0, sortOrder: 0,
        },
        {
          id: "o-side-b", groupId: "g-buffet-sides", offeringId: null, label: "Bread",
          description: null, isIncluded: true, unitPrice: 0, sortOrder: 1,
        },
      ],
    };
    const platedOk = validateChoicesAnswers(dinner, {
      "g-dinner": { optionIds: ["o-plated"] },
      "g-plated-entrees": { optionIds: ["o-entree"] },
    });
    assert.equal(platedOk.ok, true);
    const crossParent = validateChoicesAnswers(dinner, {
      "g-dinner": { optionIds: ["o-plated"] },
      "g-plated-entrees": { optionIds: ["o-entree"] },
      "g-buffet-sides": { optionIds: ["o-side-a", "o-side-b"] },
    });
    assert.equal(crossParent.ok, false);
    const buffetMissing = validateChoicesAnswers(dinner, {
      "g-dinner": { optionIds: ["o-buffet"] },
    });
    assert.equal(buffetMissing.ok, false);
  });

  it("applies the same optional exact-count rules for Premium Open Bar and Guest Paid Bar groups", () => {
    function barDefinition(parentId: string, parentLabel: string): ChoicesDefinition {
      return {
        sections: [],
        groups: [
          {
            id: "g-bar",
            sectionId: null,
            name: "Bar option",
            instructions: `Choose one bar option: ${parentLabel}`,
            selectionMode: "single",
            minSelect: 1,
            maxSelect: 1,
            allowQuantity: false,
            sortOrder: 0,
          },
          {
            id: "g-spirits",
            sectionId: null,
            name: "Spirits",
            instructions: null,
            selectionMode: "multi",
            minSelect: 2,
            maxSelect: 2,
            allowQuantity: false,
            sortOrder: 1,
            dependsOnOptionIds: [parentId],
          },
        ],
        options: [
          {
            id: parentId, groupId: "g-bar", offeringId: null, label: parentLabel,
            description: null, isIncluded: true, unitPrice: 0, sortOrder: 0,
          },
          {
            id: `${parentId}-s1`, groupId: "g-spirits", offeringId: null, label: "Vodka",
            description: null, isIncluded: true, unitPrice: 0, sortOrder: 0,
          },
          {
            id: `${parentId}-s2`, groupId: "g-spirits", offeringId: null, label: "Gin",
            description: null, isIncluded: true, unitPrice: 0, sortOrder: 1,
          },
          {
            id: `${parentId}-s3`, groupId: "g-spirits", offeringId: null, label: "Whiskey",
            description: null, isIncluded: true, unitPrice: 0, sortOrder: 2,
          },
        ],
      };
    }
    for (const [id, label] of [
      ["o-premium", "Premium Open Bar"],
      ["o-guest", "Guest Paid Bar Offering"],
    ] as const) {
      const def = barDefinition(id, label);
      assert.equal(
        validateChoicesAnswers(def, {
          "g-bar": { optionIds: [id] },
          "g-spirits": { optionIds: [`${id}-s1`, `${id}-s2`] },
        }).ok,
        true,
        label,
      );
      assert.equal(
        validateChoicesAnswers(def, {
          "g-bar": { optionIds: [id] },
          "g-spirits": { optionIds: [`${id}-s1`] },
        }).ok,
        false,
        `${label} under-select`,
      );
    }
  });

  it("skips inactive required dependents and rejects orphan child answers", () => {
    const withDeps: ChoicesDefinition = {
      ...definition,
      groups: [
        ...definition.groups,
        {
          id: "g-plated",
          sectionId: null,
          name: "Plated dinner details",
          instructions: null,
          selectionMode: "single",
          minSelect: 1,
          maxSelect: 1,
          allowQuantity: false,
          sortOrder: 2,
          dependsOnOptionIds: ["o-plated"],
        },
      ],
      options: [
        ...definition.options,
        {
          id: "o-detail", groupId: "g-plated", offeringId: null, label: "Detail",
          description: null, isIncluded: false, unitPrice: 0, sortOrder: 0,
        },
      ],
    };
    // Buffet selected → plated child inactive → does not block.
    assert.equal(
      validateChoicesAnswers(withDeps, { "g-dinner": { optionIds: ["o-buffet"] } }).ok,
      true,
    );
    // Plated without child → blocks.
    const missing = validateChoicesAnswers(withDeps, { "g-dinner": { optionIds: ["o-plated"] } });
    assert.equal(missing.ok, false);
    // Orphan buffet child while plated active → rejected.
    const orphan = validateChoicesAnswers(withDeps, {
      "g-dinner": { optionIds: ["o-buffet"] },
      "g-plated": { optionIds: ["o-detail"] },
    });
    assert.equal(orphan.ok, false);
  });
});
