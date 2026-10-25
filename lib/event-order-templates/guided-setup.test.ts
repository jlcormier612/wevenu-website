import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SUGGESTED_CATEGORIES,
  branchGuideForSection,
  buildReviewSummary,
  detectPatternsForSection,
  emptyDependentGroupInput,
  matchSuggestedCategory,
  nextConfigureSubstep,
  selectedCategoryKeysFromTemplate,
} from "@/lib/event-order-templates/guided-setup";
import type {
  EventOrderTemplateGroup,
  EventOrderTemplateOption,
  EventOrderTemplateSection,
  EventOrderTemplateWithDetails,
} from "@/lib/event-order-templates/types";

function section(
  partial: Partial<EventOrderTemplateSection> & Pick<EventOrderTemplateSection, "id" | "name">,
): EventOrderTemplateSection {
  return {
    templateId: "t1",
    venueId: "v1",
    guidance: null,
    sortOrder: 0,
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

function group(
  partial: Partial<EventOrderTemplateGroup> & Pick<EventOrderTemplateGroup, "id" | "name">,
): EventOrderTemplateGroup {
  return {
    templateId: "t1",
    venueId: "v1",
    sectionId: "sec-catering",
    instructions: null,
    selectionMode: "single",
    minSelect: 1,
    maxSelect: 1,
    allowQuantity: false,
    sortOrder: 0,
    dependsOnOptionIds: [],
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

function option(
  partial: Partial<EventOrderTemplateOption> & Pick<EventOrderTemplateOption, "id" | "groupId" | "label">,
): EventOrderTemplateOption {
  return {
    templateId: "t1",
    venueId: "v1",
    offeringId: null,
    description: null,
    isIncluded: false,
    unitPrice: null,
    isDefault: false,
    sortOrder: 0,
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

function template(partial: Partial<EventOrderTemplateWithDetails>): EventOrderTemplateWithDetails {
  return {
    id: "t1",
    venueId: "v1",
    name: "Test",
    description: null,
    sourceMasterKey: null,
    isArchived: false,
    createdAt: "",
    updatedAt: "",
    sections: [],
    lines: [],
    groups: [],
    options: [],
    ...partial,
  };
}

describe("guided setup — categories", () => {
  it("matches suggested categories including Bar aliases without inventing links", () => {
    assert.equal(matchSuggestedCategory("Catering")?.key, "catering");
    assert.equal(matchSuggestedCategory("Bar")?.key, "bar");
    assert.equal(matchSuggestedCategory("Bar Service")?.key, "bar");
    assert.equal(matchSuggestedCategory("Specialty Lighting")?.key ?? null, null);
    assert.ok(SUGGESTED_CATEGORIES.some((c) => c.key === "florals"));
  });

  it("derives selected keys from existing sections and keeps custom names", () => {
    const keys = selectedCategoryKeysFromTemplate([
      section({ id: "1", name: "Catering" }),
      section({ id: "2", name: "Bar" }),
      section({ id: "3", name: "Specialty Lighting" }),
    ]);
    assert.deepEqual(keys.suggested.sort(), ["bar", "catering"]);
    assert.deepEqual(keys.customNames, ["Specialty Lighting"]);
  });
});

describe("guided setup — patterns and branches", () => {
  it("detects choose-one + related patterns from plated/buffet tree", () => {
    const plated = option({ id: "opt-p", groupId: "g-dinner", label: "Plated Dinner" });
    const buffet = option({ id: "opt-b", groupId: "g-dinner", label: "Buffet Dinner" });
    const dinner = group({ id: "g-dinner", name: "Dinner service" });
    const platedDetails = group({
      id: "g-pd",
      name: "Plated dinner details",
      dependsOnOptionIds: ["opt-p"],
    });
    const t = template({
      sections: [section({ id: "sec-catering", name: "Catering" })],
      groups: [dinner, platedDetails],
      options: [plated, buffet],
    });
    const patterns = detectPatternsForSection(t, "sec-catering");
    assert.ok(patterns.includes("choose_one"));
    assert.ok(patterns.includes("choose_then_related"));

    const branches = branchGuideForSection(t, "sec-catering");
    assert.equal(branches.length, 2);
    assert.equal(branches.find((b) => b.optionId === "opt-p")?.incomplete, true);
    assert.equal(branches.find((b) => b.optionId === "opt-b")?.dependents.length, 0);
  });

  it("builds empty dependent input with explicit parent option id (never by name)", () => {
    const opt = option({ id: "opt-p", groupId: "g1", label: "Plated Dinner", unitPrice: 85 });
    const input = emptyDependentGroupInput("sec-catering", opt);
    assert.deepEqual(input.dependsOnOptionIds, ["opt-p"]);
    assert.match(input.name, /Plated Dinner/);
  });

  it("advances configure substeps based on selected patterns", () => {
    assert.equal(nextConfigureSubstep("patterns", ["included"]), "fixed");
    assert.equal(nextConfigureSubstep("fixed", ["included", "choose_one"]), "choices");
    assert.equal(nextConfigureSubstep("choices", ["choose_then_related"]), "branches");
    assert.equal(nextConfigureSubstep("branches", ["choose_then_related"]), "done");
    assert.equal(nextConfigureSubstep("patterns", ["choose_one"]), "choices");
  });
});

describe("guided setup — review summary", () => {
  it("summarizes fixed lines, options, and incomplete dependents", () => {
    const t = template({
      sections: [section({ id: "sec-catering", name: "Catering" })],
      lines: [{
        id: "l1",
        templateId: "t1",
        venueId: "v1",
        sectionId: "sec-catering",
        description: "Day-of Coordination",
        descriptionDetail: null,
        quantity: 1,
        unitPrice: 1200,
        pricingModel: "flat",
        unit: null,
        includedByDefault: true,
        offeringId: null,
        sortOrder: 0,
        createdAt: "",
        updatedAt: "",
      }],
      groups: [
        group({ id: "g-dinner", name: "Dinner service" }),
        group({
          id: "g-pd",
          name: "Plated dinner details",
          dependsOnOptionIds: ["opt-p"],
        }),
      ],
      options: [
        option({ id: "opt-p", groupId: "g-dinner", label: "Plated Dinner", unitPrice: 85 }),
      ],
    });
    const review = buildReviewSummary(t);
    assert.equal(review.length, 1);
    assert.equal(review[0]!.fixedLines.length, 1);
    assert.ok(review[0]!.incompleteMessages.length >= 1);
    assert.ok(review[0]!.groups.some((g) => g.isDependent && g.incomplete));
  });
});
