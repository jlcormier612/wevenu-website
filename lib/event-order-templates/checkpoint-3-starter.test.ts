/**
 * Checkpoint 3 — complete Wedding Reception starter, Day-of Coordination
 * commercial correction, and isolated new-venue provisioning mapping.
 * Does not write venue templates or invoices.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

import {
  financialDeltaFromLines,
  resolveSelectedOptions,
} from "@/lib/client-choices/apply-to-event-order";
import { orderedVisibleChoiceGroups } from "@/lib/client-choices/conditional-groups";
import { toggleChoiceOption } from "@/lib/client-choices/interactive-selection";
import { choiceOptionPriceLabel } from "@/lib/client-choices/price-labels";
import { weddingReceptionStarterPreviewTemplate } from "@/lib/client-choices/preview-fixtures";
import { validateChoicesAnswers } from "@/lib/client-choices/validate-answers";
import { templateReadiness, simpleSelectionLabel } from "@/lib/event-order-templates/editor-presentation";
import { selectionDefinitionFromEventOrderTemplate } from "@/lib/event-order-templates/selection-definition";
import {
  EVENT_ORDER_STARTER_MASTERS,
  LEGACY_FLAT_STARTER_LINE_NAMES,
  getEventOrderStarterMaster,
  starterChoiceGroups,
  starterChoiceOptionNames,
  starterFixedLineNames,
} from "@/lib/event-order-templates/starters";
import { eventOrderStarterMasterToTemplate } from "@/lib/event-order-templates/starter-to-template";
import { sectionCompletenessIssues } from "@/lib/event-order-templates/section-workspace";

const root = join(process.cwd());

function groupByName(template: ReturnType<typeof eventOrderStarterMasterToTemplate>, name: string) {
  return template.groups.filter((g) => g.name === name);
}

function optionByLabel(template: ReturnType<typeof eventOrderStarterMasterToTemplate>, label: string) {
  return template.options.find((o) => o.label === label);
}

function optionsForGroup(
  template: ReturnType<typeof eventOrderStarterMasterToTemplate>,
  groupId: string,
) {
  return template.options.filter((o) => o.groupId === groupId);
}

describe("Checkpoint 3 starter structure", () => {
  it("Wedding Reception has Catering, Bar, Rentals, and Services with populated dinner branches", () => {
    const master = getEventOrderStarterMaster("EO-D-01")!;
    assert.deepEqual(master.sections.map((s) => s.name), ["Catering", "Bar", "Rentals", "Services"]);
    const template = eventOrderStarterMasterToTemplate(master);
    const plated = optionByLabel(template, "Plated Dinner")!;
    const buffet = optionByLabel(template, "Buffet Dinner")!;
    const platedCats = template.groups.filter((g) => (g.dependsOnOptionIds ?? []).includes(plated.id));
    const buffetCats = template.groups.filter((g) => (g.dependsOnOptionIds ?? []).includes(buffet.id));
    assert.deepEqual(platedCats.map((g) => g.name).sort(), ["Desserts", "Entrées", "Sides"]);
    assert.deepEqual(buffetCats.map((g) => g.name).sort(), ["Desserts", "Entrées", "Sides"]);
    const platedEntrees = platedCats.find((g) => g.name === "Entrées")!;
    assert.deepEqual(
      optionsForGroup(template, platedEntrees.id).map((o) => o.label),
      ["Herb-Roasted Chicken", "Braised Beef", "Seasonal Vegetarian Entrée"],
    );
    const buffetEntrees = buffetCats.find((g) => g.name === "Entrées")!;
    assert.deepEqual(
      optionsForGroup(template, buffetEntrees.id).map((o) => o.label),
      ["Roasted Chicken", "Pasta Primavera", "Braised Beef"],
    );
  });

  it("uses existing selection-rule semantics for dinner categories", () => {
    const template = eventOrderStarterMasterToTemplate(getEventOrderStarterMaster("EO-D-01")!);
    const plated = optionByLabel(template, "Plated Dinner")!;
    const buffet = optionByLabel(template, "Buffet Dinner")!;
    const dinner = template.groups.find((g) => g.name === "Dinner service")!;
    assert.equal(simpleSelectionLabel(dinner), "Choose 1 · Required");
    const platedEntrees = template.groups.find(
      (g) => g.name === "Entrées" && (g.dependsOnOptionIds ?? []).includes(plated.id),
    )!;
    const platedSides = template.groups.find(
      (g) => g.name === "Sides" && (g.dependsOnOptionIds ?? []).includes(plated.id),
    )!;
    const platedDesserts = template.groups.find(
      (g) => g.name === "Desserts" && (g.dependsOnOptionIds ?? []).includes(plated.id),
    )!;
    const buffetEntrees = template.groups.find(
      (g) => g.name === "Entrées" && (g.dependsOnOptionIds ?? []).includes(buffet.id),
    )!;
    assert.equal(simpleSelectionLabel(platedEntrees), "Choose 1 · Required");
    assert.equal(simpleSelectionLabel(platedSides), "Choose up to 2 · Optional");
    assert.equal(simpleSelectionLabel(platedDesserts), "Choose 1 or skip · Optional");
    assert.equal(simpleSelectionLabel(buffetEntrees), "Choose 1–2 · Required");
    assert.equal(buffetEntrees.minSelect, 1);
    assert.equal(buffetEntrees.maxSelect, 2);
  });

  it("does not put Chiavari chairs in new-starter offerings while legacy fingerprints keep the name", () => {
    for (const master of EVENT_ORDER_STARTER_MASTERS) {
      assert.equal(starterChoiceOptionNames(master).includes("Chiavari Chair"), false);
      assert.equal(starterFixedLineNames(master).includes("Chiavari Chair"), false);
    }
    assert.ok(LEGACY_FLAT_STARTER_LINE_NAMES["EO-D-01"].includes("Chiavari Chair"));
    assert.ok(LEGACY_FLAT_STARTER_LINE_NAMES["EO-D-02"].includes("Chiavari Chair"));
  });
});

describe("Checkpoint 3 Day-of Coordination", () => {
  it("is an optional client-selectable service, not an included fixed line, and ships unconfigured", () => {
    const master = getEventOrderStarterMaster("EO-D-01")!;
    assert.equal(starterFixedLineNames(master).includes("Day-of Coordination"), false);
    const group = starterChoiceGroups(master).find((g) => g.name === "Optional services")!;
    assert.equal(group.minSelect, 0);
    assert.equal(group.maxSelect, 1);
    assert.equal(group.selectionMode, "single");
    const dayOf = group.options.find((o) => o.name === "Day-of Coordination")!;
    assert.equal(dayOf.unitPrice ?? null, null);
    assert.equal(dayOf.isIncluded ?? false, false);
    const template = eventOrderStarterMasterToTemplate(master);
    const opt = optionByLabel(template, "Day-of Coordination")!;
    assert.equal(choiceOptionPriceLabel(opt, false, "preview"), "Not configured");
    assert.equal(opt.isIncluded, false);
  });
});

describe("Checkpoint 3 pricing honesty", () => {
  it("does not mark illustrative menu items Included or $0", () => {
    const template = eventOrderStarterMasterToTemplate(getEventOrderStarterMaster("EO-D-01")!);
    const chicken = optionByLabel(template, "Herb-Roasted Chicken")!;
    assert.equal(chicken.unitPrice, null);
    assert.equal(chicken.isIncluded, false);
    assert.equal(choiceOptionPriceLabel(chicken, false, "preview"), "Not configured");
    const dinner = optionByLabel(template, "Plated Dinner")!;
    assert.equal(dinner.unitPrice, null);
    assert.equal(dinner.isIncluded, false);
    const beer = optionByLabel(template, "House Lager")!;
    assert.equal(beer.unitPrice, null);
    assert.equal(beer.isIncluded, false);
  });

  it("selecting an unpriced dinner choice does not fabricate a charge or an Included label", () => {
    const template = eventOrderStarterMasterToTemplate(getEventOrderStarterMaster("EO-D-01")!);
    const definition = selectionDefinitionFromEventOrderTemplate(template);
    const dinnerGroup = template.groups.find((g) => g.name === "Dinner service")!;
    const plated = optionByLabel(template, "Plated Dinner")!;
    const { answers } = toggleChoiceOption(definition, {}, dinnerGroup.id, plated.id);
    const lines = resolveSelectedOptions(definition, answers);
    const platedLine = lines.find((l) => l.optionId === plated.id)!;
    assert.equal(platedLine.isIncluded, false);
    assert.equal(platedLine.unitPrice, null);
    assert.equal(platedLine.amount, 0);
    assert.equal(financialDeltaFromLines(lines), 0);
  });

  it("keeps the illustrative starter in Draft until prices or Included decisions are set", () => {
    const template = eventOrderStarterMasterToTemplate(getEventOrderStarterMaster("EO-D-01")!);
    const issues = sectionCompletenessIssues(template.groups, template.options);
    assert.ok(issues.some((i) => i.kind === "unpriced-option"));
    assert.equal(issues.some((i) => i.kind === "empty-dependent"), false);
    assert.equal(templateReadiness(template).status, "draft");
    assert.match(templateReadiness(template).reason ?? "", /price or an Included decision/);
  });
});

describe("Checkpoint 3 client selection", () => {
  it("hides plated and buffet categories until a dinner service is chosen", () => {
    const template = weddingReceptionStarterPreviewTemplate();
    const definition = selectionDefinitionFromEventOrderTemplate(template);
    const initial = orderedVisibleChoiceGroups(definition, {}).map((g) => g.name);
    assert.ok(initial.includes("Dinner service"));
    assert.equal(initial.includes("Entrées"), false);
    assert.equal(initial.includes("Sides"), false);
    assert.equal(initial.includes("Beer selections"), false);
  });

  it("reveals only plated categories for Plated Dinner and only buffet for Buffet Dinner", () => {
    const template = weddingReceptionStarterPreviewTemplate();
    const definition = selectionDefinitionFromEventOrderTemplate(template);
    const dinner = template.groups.find((g) => g.name === "Dinner service")!;
    const plated = optionByLabel(template, "Plated Dinner")!;
    const buffet = optionByLabel(template, "Buffet Dinner")!;
    const platedAnswers = toggleChoiceOption(definition, {}, dinner.id, plated.id).answers;
    const platedVisible = orderedVisibleChoiceGroups(definition, platedAnswers);
    const platedNames = platedVisible.map((g) => g.name);
    assert.ok(platedNames.includes("Entrées"));
    assert.ok(platedNames.includes("Sides"));
    assert.ok(platedNames.includes("Desserts"));
    const platedEntreeGroup = platedVisible.find((g) => g.name === "Entrées")!;
    assert.ok(definition.options.some((o) => o.groupId === platedEntreeGroup.id && o.label === "Herb-Roasted Chicken"));
    assert.equal(
      platedVisible.some((g) => g.name === "Entrées" && (g.dependsOnOptionIds ?? []).includes(buffet.id)),
      false,
    );

    const buffetAnswers = toggleChoiceOption(definition, {}, dinner.id, buffet.id).answers;
    const buffetVisible = orderedVisibleChoiceGroups(definition, buffetAnswers);
    const buffetEntreeGroup = buffetVisible.find((g) => g.name === "Entrées")!;
    assert.ok(definition.options.some((o) => o.groupId === buffetEntreeGroup.id && o.label === "Roasted Chicken"));
    assert.equal(
      buffetVisible.some((g) => (g.dependsOnOptionIds ?? []).includes(plated.id)),
      false,
    );
  });

  it("switching dinner service drops inactive answers from effective selection", () => {
    const template = weddingReceptionStarterPreviewTemplate();
    const definition = selectionDefinitionFromEventOrderTemplate(template);
    const dinner = template.groups.find((g) => g.name === "Dinner service")!;
    const plated = optionByLabel(template, "Plated Dinner")!;
    const buffet = optionByLabel(template, "Buffet Dinner")!;
    const chicken = optionByLabel(template, "Herb-Roasted Chicken")!;
    const platedEntrees = template.groups.find(
      (g) => g.name === "Entrées" && (g.dependsOnOptionIds ?? []).includes(plated.id),
    )!;
    let { answers } = toggleChoiceOption(definition, {}, dinner.id, plated.id);
    answers = toggleChoiceOption(definition, answers, platedEntrees.id, chicken.id).answers;
    assert.ok(resolveSelectedOptions(definition, answers).some((l) => l.optionId === chicken.id));
    answers = toggleChoiceOption(definition, answers, dinner.id, buffet.id).answers;
    const lines = resolveSelectedOptions(definition, answers);
    assert.equal(lines.some((l) => l.optionId === chicken.id), false);
    assert.equal(answers[platedEntrees.id], undefined);
    assert.ok(lines.some((l) => l.optionId === buffet.id));
  });

  it("Beer & Wine reveals beer and wine selections", () => {
    const template = weddingReceptionStarterPreviewTemplate();
    const definition = selectionDefinitionFromEventOrderTemplate(template);
    const bar = template.groups.find((g) => g.name === "Bar package")!;
    const beerWine = optionByLabel(template, "Beer & Wine")!;
    const { answers } = toggleChoiceOption(definition, {}, bar.id, beerWine.id);
    const names = orderedVisibleChoiceGroups(definition, answers).map((g) => g.name);
    assert.ok(names.includes("Beer selections"));
    assert.ok(names.includes("Wine selections"));
    assert.ok(template.options.some((o) => o.label === "House Lager"));
    assert.ok(template.options.some((o) => o.label === "House Red"));
  });

  it("plated path requires an entrée and allows skipping sides and dessert", () => {
    const template = weddingReceptionStarterPreviewTemplate();
    const raw = selectionDefinitionFromEventOrderTemplate(template);
    const definition = {
      ...raw,
      options: raw.options.map((o) => ({ ...o, isIncluded: true, unitPrice: 0 })),
    };
    const dinner = template.groups.find((g) => g.name === "Dinner service")!;
    const bar = template.groups.find((g) => g.name === "Bar package")!;
    const plated = optionByLabel(template, "Plated Dinner")!;
    const beerWine = optionByLabel(template, "Beer & Wine")!;
    const chicken = optionByLabel(template, "Herb-Roasted Chicken")!;
    const platedEntrees = template.groups.find(
      (g) => g.name === "Entrées" && (g.dependsOnOptionIds ?? []).includes(plated.id),
    )!;
    let { answers } = toggleChoiceOption(definition, {}, dinner.id, plated.id);
    const before = validateChoicesAnswers(definition, answers);
    assert.equal(before.ok, false);
    assert.match(before.ok ? "" : before.message, /Entrées/);
    answers = toggleChoiceOption(definition, answers, platedEntrees.id, chicken.id).answers;
    answers = toggleChoiceOption(definition, answers, bar.id, beerWine.id).answers;
    const after = validateChoicesAnswers(definition, answers);
    assert.equal(after.ok, true);
  });
});

describe("Checkpoint 3 new-venue provisioning mapping", () => {
  it("maps starter masters the same way insertStarterFromMaster persists fields", () => {
    const provision = readFileSync(join(root, "lib/event-order-templates/provision.ts"), "utf8");
    assert.match(provision, /insertStarterFromMaster/);
    assert.match(provision, /included_by_default: offering.includedByDefault \?\? false/);
    assert.match(provision, /unit_price: isIncluded \? 0 : \(opt.unitPrice \?\? null\)/);
    assert.match(provision, /depends_on_option_ids: dependsOn/);
    const template = eventOrderStarterMasterToTemplate(getEventOrderStarterMaster("EO-D-01")!);
    const dayOf = optionByLabel(template, "Day-of Coordination")!;
    assert.equal(dayOf.unitPrice, null);
    assert.equal(dayOf.isIncluded, false);
    assert.equal(template.lines.some((l) => l.description === "Day-of Coordination"), false);
    assert.equal(template.sourceMasterKey, "EO-D-01");
  });

  it("does not add populated starter follow-ups onto existing venue copies", () => {
    const provision = readFileSync(join(root, "lib/event-order-templates/provision.ts"), "utf8");
    assert.match(provision, /group.options.length > 0/);
    assert.match(provision, /already_has_groups/);
    assert.match(provision, /skipped.push\(master.key\)/);
    assert.match(provision, /existing venue copies are not given new menu-category shells/);
  });

  it("Ceremony \+ Reception keeps Ceremony Coordination as an unconfigured example choice", () => {
    const master = getEventOrderStarterMaster("EO-D-02")!;
    const template = eventOrderStarterMasterToTemplate(master);
    assert.equal(template.lines.some((l) => l.description === "Ceremony Coordination"), false);
    const ceremony = optionByLabel(template, "Ceremony Coordination")!;
    assert.equal(ceremony.isIncluded, false);
    assert.equal(ceremony.unitPrice, null);
    const dayOf = optionByLabel(template, "Day-of Coordination")!;
    assert.equal(dayOf.isIncluded, false);
    assert.equal(dayOf.unitPrice, null);
    assert.equal(groupByName(template, "Optional rentals").length, 0);
    assert.ok(template.sections.some((s) => s.name === "Rentals"));
  });
});
