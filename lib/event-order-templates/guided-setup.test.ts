import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SUGGESTED_CATEGORIES,
  branchGuideForSection,
  buildReviewSummary,
  canonicalSectionNameForSuggested,
  dependentCategoryGroupInput,
  detectPatternsForSection,
  emptyDependentGroupInput,
  matchSuggestedCategory,
  nextConfigureSubstep,
  prevConfigureSubstep,
  patternsPayloadFromDrafts,
  plainSelectionRuleLabel,
  resolvePlainSelectionRule,
  seedPatternDraftsFromTemplate,
  selectedCategoryKeysFromTemplate,
  togglePatternInDraft,
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
    imageUrl: null,
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

  it("includes Ceremony as a typed suggested category with aliases", () => {
    const ceremony = SUGGESTED_CATEGORIES.find((c) => c.key === "ceremony");
    assert.ok(ceremony, "ceremony must be in SUGGESTED_CATEGORIES");
    assert.equal(ceremony!.name, "Ceremony");
    assert.ok(ceremony!.aliases.includes("ceremony"));
    assert.ok(ceremony!.aliases.includes("aisle"));
    assert.equal(matchSuggestedCategory("Ceremony")?.key, "ceremony");
    assert.equal(matchSuggestedCategory("ceremony decor")?.key, "ceremony");
    assert.equal(matchSuggestedCategory("Aisle")?.key, "ceremony");
    assert.equal(canonicalSectionNameForSuggested("ceremony"), "Ceremony");
    // Every SUGGESTED_CATEGORIES key (except custom) is assignable to SuggestedCategoryKey
    // via the array typing — this also guards the Ceremony union membership that broke Sandbox.
    for (const cat of SUGGESTED_CATEGORIES) {
      assert.equal(typeof cat.key, "string");
      assert.ok(cat.key.length > 0);
    }
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

  it("maps a persisted Ceremony section back to the ceremony suggested key", () => {
    const keys = selectedCategoryKeysFromTemplate([
      section({ id: "1", name: "Ceremony" }),
      section({ id: "2", name: "Catering" }),
    ]);
    assert.deepEqual(keys.suggested.sort(), ["catering", "ceremony"]);
    assert.deepEqual(keys.customNames, []);
  });
});

describe("guided setup — patterns and branches", () => {
  it("detects choose-one from plated/buffet tree without a separate related pattern", () => {
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
    assert.ok(!patterns.includes("choose_then_related"));

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

  it("ordinary configure path is a single workspace (no pattern ladder)", () => {
    assert.equal(nextConfigureSubstep("workspace", ["included"]), "done");
    assert.equal(nextConfigureSubstep("workspace", ["choose_one"]), "done");
    assert.equal(nextConfigureSubstep("workspace", ["included", "choose_one", "optional_add"]), "done");
    assert.equal(prevConfigureSubstep("workspace", ["choose_one"]), "categories");
  });
});

describe("guided setup — pattern drafts survive category switches", () => {
  const emptyTemplate = () =>
    template({
      sections: [
        section({ id: "sec-catering", name: "Catering", sortOrder: 0 }),
        section({ id: "sec-rentals", name: "Rentals", sortOrder: 1 }),
        section({ id: "sec-bar", name: "Bar Service", sortOrder: 2 }),
        section({ id: "sec-services", name: "Services", sortOrder: 3 }),
      ],
    });

  it("keeps Catering picks when switching to Rentals and back", () => {
    const t = emptyTemplate();
    const ids = t.sections.map((s) => s.id);
    let drafts = seedPatternDraftsFromTemplate(t, ids, {});
    drafts = togglePatternInDraft(drafts, "sec-catering", "included");
    drafts = togglePatternInDraft(drafts, "sec-catering", "choose_one");
    // Simulate tab → Rentals (re-seed must not wipe Catering)
    drafts = seedPatternDraftsFromTemplate(t, ids, drafts);
    drafts = togglePatternInDraft(drafts, "sec-rentals", "optional_add");
    drafts = seedPatternDraftsFromTemplate(t, ids, drafts);
    assert.deepEqual(drafts["sec-catering"]!.slice().sort(), ["choose_one", "included"]);
    assert.deepEqual(drafts["sec-rentals"], ["optional_add"]);
  });

  it("Continue payload includes every category's selections", () => {
    let drafts = seedPatternDraftsFromTemplate(emptyTemplate(), [
      "sec-catering",
      "sec-rentals",
      "sec-bar",
      "sec-services",
    ], {});
    drafts = togglePatternInDraft(drafts, "sec-catering", "choose_one");
    drafts = togglePatternInDraft(drafts, "sec-rentals", "choose_many");
    drafts = togglePatternInDraft(drafts, "sec-bar", "included");
    drafts = togglePatternInDraft(drafts, "sec-services", "optional_add");
    const payload = patternsPayloadFromDrafts(drafts, [
      "sec-catering",
      "sec-rentals",
      "sec-bar",
      "sec-services",
    ]);
    assert.deepEqual(payload, [
      { sectionId: "sec-catering", patterns: ["choose_one"] },
      { sectionId: "sec-rentals", patterns: ["choose_many"] },
      { sectionId: "sec-bar", patterns: ["included"] },
      { sectionId: "sec-services", patterns: ["optional_add"] },
    ]);
  });

  it("repeated switches neither lose nor duplicate selections", () => {
    const t = emptyTemplate();
    const ids = ["sec-catering", "sec-rentals"];
    let drafts = seedPatternDraftsFromTemplate(t, ids, {});
    drafts = togglePatternInDraft(drafts, "sec-catering", "included");
    drafts = togglePatternInDraft(drafts, "sec-catering", "choose_one");
    for (let i = 0; i < 8; i++) {
      drafts = seedPatternDraftsFromTemplate(t, ids, drafts);
      const focus = i % 2 === 0 ? "sec-rentals" : "sec-catering";
      if (focus === "sec-rentals" && !(drafts["sec-rentals"] ?? []).includes("choose_many")) {
        drafts = togglePatternInDraft(drafts, "sec-rentals", "choose_many");
      }
    }
    assert.deepEqual(drafts["sec-catering"]!.slice().sort(), [
      "choose_one",
      "included",
    ]);
    assert.deepEqual(drafts["sec-rentals"], ["choose_many"]);
    assert.equal(drafts["sec-catering"]!.filter((p) => p === "included").length, 1);
  });

  it("normalizes legacy choose_then_related drafts to choose_one", () => {
    const t = emptyTemplate();
    const ids = ["sec-catering"];
    let drafts: ReturnType<typeof seedPatternDraftsFromTemplate> = {
      "sec-catering": ["included", "choose_then_related"],
    };
    drafts = seedPatternDraftsFromTemplate(t, ids, drafts);
    assert.deepEqual(drafts["sec-catering"]!.slice().sort(), ["choose_one", "included"]);
    assert.ok(!drafts["sec-catering"]!.includes("choose_then_related"));
  });

  it("edit path initializes from persisted groups and lines", () => {
    const t = template({
      sections: [
        section({ id: "sec-catering", name: "Catering", sortOrder: 0 }),
        section({ id: "sec-rentals", name: "Rentals", sortOrder: 1 }),
      ],
      lines: [{
        id: "l1",
        templateId: "t1",
        venueId: "v1",
        sectionId: "sec-catering",
        description: "Staff meal",
        descriptionDetail: null,
        quantity: 1,
        unitPrice: 0,
        pricingModel: "flat",
        unit: null,
        includedByDefault: true,
        offeringId: null,
        sortOrder: 0,
        createdAt: "",
        updatedAt: "",
      }],
      groups: [
        group({
          id: "g-rent",
          name: "Rental options",
          sectionId: "sec-rentals",
          selectionMode: "multi",
          minSelect: 0,
          maxSelect: null,
          allowQuantity: true,
        }),
      ],
      options: [],
    });
    const drafts = seedPatternDraftsFromTemplate(t, ["sec-catering", "sec-rentals"], {});
    assert.ok(drafts["sec-catering"]!.includes("included"));
    assert.ok(drafts["sec-rentals"]!.includes("optional_add"));
    assert.ok(drafts["sec-rentals"]!.includes("choose_many"));
  });

  it("backward/forward navigation preserves drafts (re-seed is a no-op)", () => {
    const t = emptyTemplate();
    const ids = ["sec-catering", "sec-rentals"];
    let drafts = seedPatternDraftsFromTemplate(t, ids, {});
    drafts = togglePatternInDraft(drafts, "sec-catering", "choose_one");
    drafts = togglePatternInDraft(drafts, "sec-rentals", "included");
    const afterBack = seedPatternDraftsFromTemplate(t, ids, drafts);
    assert.equal(afterBack, drafts);
    const afterForward = seedPatternDraftsFromTemplate(t, ids, afterBack);
    assert.deepEqual(afterForward["sec-catering"], ["choose_one"]);
    assert.deepEqual(afterForward["sec-rentals"], ["included"]);
  });

  it("toggling off a pattern updates only that category", () => {
    let drafts = seedPatternDraftsFromTemplate(emptyTemplate(), ["sec-catering", "sec-florals"], {});
    drafts = togglePatternInDraft(drafts, "sec-catering", "included");
    drafts = togglePatternInDraft(drafts, "sec-catering", "choose_one");
    drafts = togglePatternInDraft(drafts, "sec-florals", "optional_add");
    drafts = togglePatternInDraft(drafts, "sec-catering", "included");
    assert.deepEqual(drafts["sec-catering"], ["choose_one"]);
    assert.deepEqual(drafts["sec-florals"], ["optional_add"]);
  });

  it("empty patterns payload is the validation signal for Continue", () => {
    const drafts = seedPatternDraftsFromTemplate(emptyTemplate(), ["sec-catering"], {});
    const payload = patternsPayloadFromDrafts(drafts, ["sec-catering"]);
    assert.deepEqual(payload[0]!.patterns, []);
    assert.equal(payload[0]!.patterns.length === 0, true);
  });

  it("blocked Continue on empty category does not clear sibling drafts", () => {
    const t = emptyTemplate();
    const ids = ["sec-catering", "sec-rentals"];
    let drafts = seedPatternDraftsFromTemplate(t, ids, {});
    drafts = togglePatternInDraft(drafts, "sec-rentals", "choose_one");
    drafts = togglePatternInDraft(drafts, "sec-rentals", "optional_add");
    // Catering still empty → Continue must block; drafts must remain untouched.
    assert.deepEqual(drafts["sec-catering"], []);
    const blocked = (drafts["sec-catering"] ?? []).length === 0;
    assert.equal(blocked, true);
    drafts = seedPatternDraftsFromTemplate(t, ids, drafts);
    assert.deepEqual(drafts["sec-rentals"]!.slice().sort(), ["choose_one", "optional_add"]);
    assert.deepEqual(drafts["sec-catering"], []);
  });

  it("UI selection for the active section matches its Continue payload entry", () => {
    let drafts = seedPatternDraftsFromTemplate(emptyTemplate(), ["sec-catering", "sec-rentals"], {});
    drafts = togglePatternInDraft(drafts, "sec-catering", "included");
    drafts = togglePatternInDraft(drafts, "sec-catering", "choose_one");
    drafts = togglePatternInDraft(drafts, "sec-rentals", "choose_many");
    const payload = patternsPayloadFromDrafts(drafts, ["sec-catering", "sec-rentals"]);
    assert.deepEqual(
      payload.find((p) => p.sectionId === "sec-catering")!.patterns,
      drafts["sec-catering"],
    );
    assert.deepEqual(
      payload.find((p) => p.sectionId === "sec-rentals")!.patterns,
      drafts["sec-rentals"],
    );
  });

  it("rapid toggles never duplicate a pattern id", () => {
    let drafts: ReturnType<typeof seedPatternDraftsFromTemplate> = {};
    drafts = togglePatternInDraft(drafts, "sec-catering", "included");
    drafts = togglePatternInDraft(drafts, "sec-catering", "included");
    drafts = togglePatternInDraft(drafts, "sec-catering", "included");
    drafts = togglePatternInDraft(drafts, "sec-catering", "choose_one");
    drafts = togglePatternInDraft(drafts, "sec-catering", "choose_one");
    drafts = togglePatternInDraft(drafts, "sec-catering", "choose_one");
    assert.deepEqual(drafts["sec-catering"]!.slice().sort(), ["choose_one", "included"]);
    assert.equal(new Set(drafts["sec-catering"]).size, drafts["sec-catering"]!.length);
  });

  it("custom category section ids keep independent drafts across switches", () => {
    const t = template({
      sections: [
        section({ id: "sec-catering", name: "Catering", sortOrder: 0 }),
        section({ id: "sec-custom-lights", name: "Specialty Lighting", sortOrder: 1 }),
      ],
    });
    const ids = ["sec-catering", "sec-custom-lights"];
    let drafts = seedPatternDraftsFromTemplate(t, ids, {});
    drafts = togglePatternInDraft(drafts, "sec-catering", "choose_one");
    drafts = seedPatternDraftsFromTemplate(t, ids, drafts);
    drafts = togglePatternInDraft(drafts, "sec-custom-lights", "included");
    drafts = togglePatternInDraft(drafts, "sec-custom-lights", "optional_add");
    drafts = seedPatternDraftsFromTemplate(t, ids, drafts);
    assert.deepEqual(drafts["sec-catering"], ["choose_one"]);
    assert.deepEqual(drafts["sec-custom-lights"]!.slice().sort(), ["included", "optional_add"]);
    const payload = patternsPayloadFromDrafts(drafts, ids);
    assert.equal(payload.length, 2);
    assert.ok(payload.every((p) => p.patterns.length > 0));
  });

  it("Florals and Décor coexist with Catering/Rentals in the Continue payload", () => {
    const t = template({
      sections: [
        section({ id: "sec-catering", name: "Catering", sortOrder: 0 }),
        section({ id: "sec-rentals", name: "Rentals", sortOrder: 1 }),
        section({ id: "sec-florals", name: "Florals", sortOrder: 2 }),
        section({ id: "sec-decor", name: "Décor", sortOrder: 3 }),
      ],
    });
    const ids = t.sections.map((s) => s.id);
    let drafts = seedPatternDraftsFromTemplate(t, ids, {});
    for (const [id, pattern] of [
      ["sec-catering", "choose_one"],
      ["sec-rentals", "choose_many"],
      ["sec-florals", "optional_add"],
      ["sec-decor", "included"],
    ] as const) {
      drafts = togglePatternInDraft(drafts, id, pattern);
      drafts = seedPatternDraftsFromTemplate(t, ids, drafts);
    }
    assert.deepEqual(patternsPayloadFromDrafts(drafts, ids), [
      { sectionId: "sec-catering", patterns: ["choose_one"] },
      { sectionId: "sec-rentals", patterns: ["choose_many"] },
      { sectionId: "sec-florals", patterns: ["optional_add"] },
      { sectionId: "sec-decor", patterns: ["included"] },
    ]);
  });
});

describe("guided setup — review summary", () => {
  it("summarizes fixed lines, options, and incomplete dependents nested under parents", () => {
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
        option({ id: "opt-b", groupId: "g-dinner", label: "Buffet Dinner", unitPrice: 65 }),
      ],
    });
    const review = buildReviewSummary(t);
    assert.equal(review.length, 1);
    assert.equal(review[0]!.fixedLines.length, 1);
    assert.ok(review[0]!.fixedLines[0]!.included);
    assert.ok(review[0]!.incompleteMessages.length >= 1);
    const dinner = review[0]!.groups.find((g) => g.id === "g-dinner");
    assert.ok(dinner);
    assert.equal(dinner!.isDependent, false);
    const plated = dinner!.options.find((o) => o.id === "opt-p");
    const buffet = dinner!.options.find((o) => o.id === "opt-b");
    assert.equal(plated!.followUps.length, 1);
    assert.equal(plated!.followUps[0]!.id, "g-pd");
    assert.equal(plated!.followUps[0]!.incomplete, true);
    assert.equal(buffet!.followUps.length, 0);
    assert.match(review[0]!.previewPathHint ?? "", /Catering → Plated Dinner/);
  });

  it("does not attach plated follow-ups to buffet in the review tree", () => {
    const t = template({
      sections: [section({ id: "sec-catering", name: "Catering" })],
      groups: [
        group({ id: "g-dinner", name: "Dinner service" }),
        group({
          id: "g-entree",
          name: "Entrée choice",
          dependsOnOptionIds: ["opt-p"],
          minSelect: 1,
        }),
      ],
      options: [
        option({ id: "opt-p", groupId: "g-dinner", label: "Plated Dinner" }),
        option({ id: "opt-b", groupId: "g-dinner", label: "Buffet Dinner" }),
        option({ id: "opt-e1", groupId: "g-entree", label: "Chicken" }),
      ],
    });
    const review = buildReviewSummary(t);
    const dinner = review[0]!.groups[0]!;
    assert.equal(dinner.options.find((o) => o.label === "Buffet Dinner")!.followUps.length, 0);
    assert.equal(
      dinner.options.find((o) => o.label === "Plated Dinner")!.followUps[0]!.name,
      "Entrée choice",
    );
  });

  it("guest-paid bar option keeps its own price and does not inherit open-bar hosted charge", () => {
    const t = template({
      sections: [section({ id: "sec-bar", name: "Bar Service" })],
      groups: [
        group({ id: "g-bar", name: "Bar package", sectionId: "sec-bar" }),
        group({
          id: "g-sig",
          name: "Optional signature cocktails",
          sectionId: "sec-bar",
          selectionMode: "multi",
          minSelect: 0,
          maxSelect: null,
          allowQuantity: true,
          dependsOnOptionIds: ["opt-open"],
        }),
      ],
      options: [
        option({
          id: "opt-open",
          groupId: "g-bar",
          label: "Open Bar",
          unitPrice: 45,
          isIncluded: false,
        }),
        option({
          id: "opt-guest",
          groupId: "g-bar",
          label: "Guest-Paid Beer and Wine",
          unitPrice: null,
          isIncluded: true,
        }),
        option({
          id: "opt-sig",
          groupId: "g-sig",
          label: "Signature cocktail",
          unitPrice: 12,
          isIncluded: false,
        }),
      ],
    });
    const review = buildReviewSummary(t);
    const bar = review[0]!.groups.find((g) => g.id === "g-bar")!;
    const open = bar.options.find((o) => o.id === "opt-open")!;
    const guest = bar.options.find((o) => o.id === "opt-guest")!;
    assert.equal(open.unitPrice, 45);
    assert.equal(open.isIncluded, false);
    assert.equal(guest.unitPrice, null);
    assert.equal(guest.isIncluded, true);
    assert.equal(guest.followUps.length, 0);
    assert.equal(open.followUps.length, 1);
    assert.equal(open.followUps[0]!.options[0]!.unitPrice, 12);
    assert.equal(open.followUps[0]!.options[0]!.isIncluded, false);
  });

  it("included template-only arbor is not presented as an optional extra charge", () => {
    const t = template({
      sections: [section({ id: "sec-rentals", name: "Rentals" })],
      lines: [{
        id: "l-arbor",
        templateId: "t1",
        venueId: "v1",
        sectionId: "sec-rentals",
        description: "Ceremony arbor",
        descriptionDetail: null,
        quantity: 1,
        unitPrice: 0,
        pricingModel: "flat",
        unit: null,
        includedByDefault: true,
        offeringId: null,
        sortOrder: 0,
        createdAt: "",
        updatedAt: "",
      }],
    });
    const review = buildReviewSummary(t);
    assert.equal(review[0]!.fixedLines[0]!.included, true);
    assert.equal(review[0]!.fixedLines[0]!.catalog, false);
    assert.equal(review[0]!.fixedLines[0]!.description, "Ceremony arbor");
  });

  it("plain selection rules map onto existing min/max/mode without a new model", () => {
    assert.deepEqual(resolvePlainSelectionRule({ selectCount: 1, required: true }), {
      selectionMode: "single",
      minSelect: 1,
      maxSelect: 1,
    });
    assert.deepEqual(resolvePlainSelectionRule({ selectCount: 3, required: true }), {
      selectionMode: "multi",
      minSelect: 3,
      maxSelect: 3,
    });
    assert.deepEqual(resolvePlainSelectionRule({ selectCount: 2, required: false }), {
      selectionMode: "multi",
      minSelect: 0,
      maxSelect: 2,
    });
    assert.deepEqual(resolvePlainSelectionRule({ selectCount: null, required: false }), {
      selectionMode: "multi",
      minSelect: 0,
      maxSelect: null,
    });
    assert.equal(
      plainSelectionRuleLabel({ selectionMode: "multi", minSelect: 3, maxSelect: 3 }),
      "Choose 3",
    );
    assert.equal(
      plainSelectionRuleLabel({ selectionMode: "single", minSelect: 1, maxSelect: 1 }),
      "Choose 1",
    );
    assert.equal(
      plainSelectionRuleLabel({ selectionMode: "multi", minSelect: 0, maxSelect: 2 }),
      "Optional — choose exactly 2 or skip",
    );
  });

  it("parseCoupleSelectCount rejects blank and non-integers", async () => {
    const { parseCoupleSelectCount, impossibleSelectionGroupMessage } = await import(
      "@/lib/event-order-templates/guided-setup"
    );
    assert.equal(parseCoupleSelectCount("").ok, false);
    assert.equal(parseCoupleSelectCount("1.5").ok, false);
    assert.equal(parseCoupleSelectCount("-1").ok, false);
    assert.deepEqual(parseCoupleSelectCount("2"), { ok: true, count: 2 });
    assert.deepEqual(parseCoupleSelectCount("0"), { ok: true, count: 0 });
    assert.match(
      impossibleSelectionGroupMessage(
        { name: "Spirits", minSelect: 2, maxSelect: 2 },
        1,
      ) ?? "",
      /requires 2/,
    );
    assert.equal(
      impossibleSelectionGroupMessage(
        { name: "Spirits", minSelect: 2, maxSelect: 2 },
        2,
      ),
      null,
    );
  });

  it("dependent category input scopes follows to one parent option", () => {
    const parent = option({ id: "opt-buffet", groupId: "g-dinner", label: "Buffet" });
    const input = dependentCategoryGroupInput("sec-catering", parent, "Side dishes", {
      selectCount: 3,
      required: true,
    });
    assert.equal(input.name, "Side dishes");
    assert.deepEqual(input.dependsOnOptionIds, ["opt-buffet"]);
    assert.equal(input.selectionMode, "multi");
    assert.equal(input.minSelect, 3);
    assert.equal(input.maxSelect, 3);
    assert.match(input.instructions, /Buffet/);
  });
});
