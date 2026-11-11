import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCoupleApproveSummary } from "@/lib/event-orders/couple-approve-summary";
import type { ChoicesDefinition } from "@/lib/client-choices/types";

describe("couple approve summary", () => {
  it("lists included lines and selected choices separately", () => {
    const definition: ChoicesDefinition = {
      sections: [{ id: "sec", name: "Catering", guidance: null, sortOrder: 0 }],
      groups: [
        {
          id: "g1",
          sectionId: "sec",
          name: "Dinner style",
          instructions: null,
          selectionMode: "single",
          minSelect: 1,
          maxSelect: 1,
          allowQuantity: false,
          sortOrder: 0,
          dependsOnOptionIds: [],
        },
      ],
      options: [
        {
          id: "o1",
          groupId: "g1",
          label: "Plated",
          description: null,
          sortOrder: 0,
          unitPrice: null,
          isIncluded: true,
          offeringId: null,
        },
        {
          id: "o2",
          groupId: "g1",
          label: "Buffet",
          description: null,
          sortOrder: 1,
          unitPrice: null,
          isIncluded: true,
          offeringId: null,
        },
      ],
    };

    const summary = buildCoupleApproveSummary({
      lines: [
        { id: "l1", description: "Venue coordinator", sectionId: "sec" },
        { id: "l2", description: "Tables & chairs", sectionId: "sec" },
      ],
      definition,
      answers: { g1: { optionIds: ["o1"] } },
    });

    assert.equal(summary.included.length, 2);
    assert.equal(summary.included[0]!.description, "Venue coordinator");
    assert.equal(summary.choices.length, 1);
    assert.equal(summary.choices[0]!.groupName, "Dinner style");
    assert.deepEqual(summary.choices[0]!.optionLabels, ["Plated"]);
  });

  it("omits groups with no selected options", () => {
    const summary = buildCoupleApproveSummary({
      lines: [{ id: "l1", description: "Included item", sectionId: null }],
      definition: null,
      answers: {},
    });
    assert.equal(summary.included.length, 1);
    assert.equal(summary.choices.length, 0);
  });
});
