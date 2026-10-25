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
