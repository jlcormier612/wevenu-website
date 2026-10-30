import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { reconcileAndValidateChoicesAnswers } from "@/lib/client-choices/validate-answers";
import type { ChoicesDefinition } from "@/lib/client-choices/types";
import {
  impossibleSelectionGroupMessage,
  parseCoupleSelectCount,
  plainSelectionRuleLabel,
  resolvePlainSelectionRule,
} from "@/lib/event-order-templates/guided-setup";
import {
  newChildGroupUnderParentInput,
  newRootChoiceSetInput,
  optionInputFromOffering,
  optionInputWriteIn,
} from "@/lib/event-order-templates/offering-package-builder";
import type { OfferingWithCategory } from "@/lib/offerings/types";

const root = process.cwd();

describe("EO choice logic — parent / group / option model", () => {
  it("root choice sets default to choose exactly one parent offering", () => {
    const rootSet = newRootChoiceSetInput("sec", "Catering");
    assert.equal(rootSet.selectionMode, "single");
    assert.equal(rootSet.minSelect, 1);
    assert.equal(rootSet.maxSelect, 1);
  });

  it("named child groups persist exact counts and required/optional distinctly", () => {
    const required = newChildGroupUnderParentInput(
      "sec",
      { id: "o-plated", label: "Plated Dinner" },
      "Entrées",
      { selectCount: 1, required: true },
    );
    assert.equal(required.name, "Entrées");
    assert.equal(required.minSelect, 1);
    assert.equal(required.maxSelect, 1);
    assert.deepEqual(required.dependsOnOptionIds, ["o-plated"]);

    const optional = newChildGroupUnderParentInput(
      "sec",
      { id: "o-premium", label: "Premium Open Bar" },
      "Spirits",
      { selectCount: 2, required: false },
    );
    assert.equal(optional.name, "Spirits");
    assert.equal(optional.minSelect, 0);
    assert.equal(optional.maxSelect, 2);
    assert.equal(plainSelectionRuleLabel(optional), "Optional — choose exactly 2 or skip");
  });

  it("does not silently treat blank select counts as an arbitrary number when parsing", () => {
    assert.equal(parseCoupleSelectCount("").ok, false);
    assert.equal(parseCoupleSelectCount("  ").ok, false);
    assert.equal(parseCoupleSelectCount("abc").ok, false);
    assert.deepEqual(parseCoupleSelectCount("2"), { ok: true, count: 2 });
  });

  it("flags impossible required groups during template configuration", () => {
    assert.match(
      impossibleSelectionGroupMessage({ name: "Beer", minSelect: 2, maxSelect: 2 }, 0) ?? "",
      /no options/i,
    );
    assert.match(
      impossibleSelectionGroupMessage({ name: "Wine", minSelect: 2, maxSelect: 2 }, 1) ?? "",
      /requires 2/,
    );
  });

  it("catalog and write-in option drafts stay on the existing option model", () => {
    const catalog = optionInputFromOffering("g1", {
      id: "off-vodka",
      name: "House Vodka",
      venueId: "v",
      categoryId: "c",
      categoryName: "Bar",
      parentOfferingId: "off-bar",
      parentOfferingIds: ["off-bar"],
      description: null,
      unit: "bottle",
      defaultUnitPrice: 12,
      inventoryItemId: null,
      imageUrl: null,
      isArchived: false,
      sortOrder: 0,
      createdAt: "",
      updatedAt: "",
    } satisfies OfferingWithCategory);
    assert.equal(catalog.offeringId, "off-vodka");
    const writeIn = optionInputWriteIn("g1", "Custom amaro");
    assert.equal(writeIn.offeringId, null);
    assert.equal(writeIn.label, "Custom amaro");
  });

  it("builder panel separates add catalog, write-in, and catalog-group include actions", () => {
    const panel = readFileSync(
      join(root, "components/event-order-templates/package-choices-panel.tsx"),
      "utf8",
    );
    assert.match(panel, />Add item</);
    assert.match(panel, /Add write-in option/);
    assert.match(panel, /Add a category from Offerings/);
    assert.doesNotMatch(panel, /New selection group name/);
    assert.doesNotMatch(panel, /How many from this group\?/);
    assert.doesNotMatch(panel, /Add another selection group under/);
    assert.match(panel, /How many must the couple choose\?/);
    assert.match(panel, /eo-parent-dependent-groups-/);
  });

  it("switching parents clears inactive child answers before validation", () => {
    const definition: ChoicesDefinition = {
      sections: [],
      groups: [
        {
          id: "g-bar",
          sectionId: null,
          name: "Bar option",
          instructions: "Choose one bar option: Premium Open Bar or Guest Paid Bar Offering.",
          selectionMode: "single",
          minSelect: 1,
          maxSelect: 1,
          allowQuantity: false,
          sortOrder: 0,
        },
        {
          id: "g-premium-spirits",
          sectionId: null,
          name: "Spirits",
          instructions: null,
          selectionMode: "multi",
          minSelect: 2,
          maxSelect: 2,
          allowQuantity: false,
          sortOrder: 1,
          dependsOnOptionIds: ["o-premium"],
        },
        {
          id: "g-guest-spirits",
          sectionId: null,
          name: "Spirits",
          instructions: null,
          selectionMode: "multi",
          minSelect: 2,
          maxSelect: 2,
          allowQuantity: false,
          sortOrder: 2,
          dependsOnOptionIds: ["o-guest"],
        },
      ],
      options: [
        {
          id: "o-premium", groupId: "g-bar", offeringId: null, label: "Premium Open Bar",
          description: null, isIncluded: true, unitPrice: 0, sortOrder: 0,
        },
        {
          id: "o-guest", groupId: "g-bar", offeringId: null, label: "Guest Paid Bar Offering",
          description: null, isIncluded: true, unitPrice: 0, sortOrder: 1,
        },
        {
          id: "o-p1", groupId: "g-premium-spirits", offeringId: null, label: "Vodka",
          description: null, isIncluded: true, unitPrice: 0, sortOrder: 0,
        },
        {
          id: "o-p2", groupId: "g-premium-spirits", offeringId: null, label: "Gin",
          description: null, isIncluded: true, unitPrice: 0, sortOrder: 1,
        },
        {
          id: "o-g1", groupId: "g-guest-spirits", offeringId: null, label: "Well vodka",
          description: null, isIncluded: true, unitPrice: 0, sortOrder: 0,
        },
        {
          id: "o-g2", groupId: "g-guest-spirits", offeringId: null, label: "Well gin",
          description: null, isIncluded: true, unitPrice: 0, sortOrder: 1,
        },
      ],
    };

    const switched = reconcileAndValidateChoicesAnswers(definition, {
      "g-bar": { optionIds: ["o-guest"] },
      "g-premium-spirits": { optionIds: ["o-p1", "o-p2"] },
      "g-guest-spirits": { optionIds: ["o-g1", "o-g2"] },
    });
    assert.equal(switched.ok, true);
    assert.deepEqual(switched.answers["g-premium-spirits"]?.optionIds ?? [], []);
    assert.deepEqual(switched.answers["g-guest-spirits"]?.optionIds, ["o-g1", "o-g2"]);
  });

  it("resolvePlainSelectionRule keeps required count and optional skip/exact distinct", () => {
    assert.deepEqual(resolvePlainSelectionRule({ selectCount: 2, required: true }), {
      selectionMode: "multi",
      minSelect: 2,
      maxSelect: 2,
    });
    assert.deepEqual(resolvePlainSelectionRule({ selectCount: 2, required: false }), {
      selectionMode: "multi",
      minSelect: 0,
      maxSelect: 2,
    });
  });
});
