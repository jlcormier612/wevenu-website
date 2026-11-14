/**
 * Checkpoint 3B — venue-owned starter commercial configuration.
 * Isolated fixtures only. Does not write venue, invoice, or Sandbox data.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

import {
  financialDeltaFromLines,
  resolveSelectedOptions,
} from "@/lib/client-choices/apply-to-event-order";
import { toggleChoiceOption } from "@/lib/client-choices/interactive-selection";
import { choiceOptionPriceLabel } from "@/lib/client-choices/price-labels";
import { selectionProgressForGroup, selectionProgressLabel } from "@/lib/client-choices/selection-progress";
import {
  unanswerableChoicesSendMessage,
  validateChoicesAnswers,
} from "@/lib/client-choices/validate-answers";
import {
  COMPLETENESS_INTRO,
  clientCommercialLabel,
  commercialState,
  groupedCompletenessGuidance,
  venueCommercialLabel,
} from "@/lib/event-order-templates/commercial-state";
import { simpleSelectionLabel } from "@/lib/event-order-templates/editor-presentation";
import { plainSelectionRuleLabel } from "@/lib/event-order-templates/guided-setup";
import { packageBuilderPriceLabel } from "@/lib/event-order-templates/offering-package-builder";
import { selectionDefinitionFromEventOrderTemplate } from "@/lib/event-order-templates/selection-definition";
import { selectionRuleLabel } from "@/lib/event-order-templates/selection-rule-label";
import {
  EVENT_ORDER_STARTER_MASTERS,
  getEventOrderStarterMaster,
  starterChoiceOptionNames,
  starterFixedLineNames,
} from "@/lib/event-order-templates/starters";
import { eventOrderStarterMasterToTemplate } from "@/lib/event-order-templates/starter-to-template";
import {
  configureOption,
  dayOfCoordinationAdditionalFixture,
  existingVenueCustomizedCopyFixture,
  newVenueUnconfiguredStarterTemplate,
  pricedParentChildFixture,
  removeOptionByLabel,
} from "@/lib/event-order-templates/checkpoint-3b-fixtures";

const root = join(process.cwd());

function optionByLabel(template: ReturnType<typeof eventOrderStarterMasterToTemplate>, label: string) {
  return template.options.find((o) => o.label === label);
}

describe("Checkpoint 3B starter commercial corrections", () => {
  it("A. new starter has example offerings with no assumed prices or inclusions", () => {
    for (const master of EVENT_ORDER_STARTER_MASTERS) {
      const template = eventOrderStarterMasterToTemplate(master);
      for (const opt of template.options) {
        assert.equal(opt.isIncluded, false, `${master.key} ${opt.label} must not be silently Included`);
        assert.equal(opt.unitPrice, null, `${master.key} ${opt.label} must not ship a price`);
        assert.equal(commercialState(opt), "not_configured");
        assert.equal(venueCommercialLabel(opt), "Not configured");
        assert.equal(clientCommercialLabel(opt, false, "preview"), "Not configured");
        assert.equal(clientCommercialLabel(opt, false, "client"), "Not available for release");
        assert.notEqual(choiceOptionPriceLabel(opt, false, "preview"), "Additional");
        assert.notEqual(choiceOptionPriceLabel(opt, false, "preview"), "Included");
        assert.doesNotMatch(choiceOptionPriceLabel(opt, false, "preview"), /\$0/);
      }
      for (const line of template.lines) {
        assert.equal(line.includedByDefault, false);
        assert.equal(line.unitPrice, null);
      }
    }
    const reception = getEventOrderStarterMaster("EO-D-01")!;
    const names = starterChoiceOptionNames(reception);
    assert.ok(names.includes("Day-of Coordination"));
    assert.ok(names.includes("Farm Table"));
    assert.ok(names.includes("Plated Dinner"));
    assert.ok(names.includes("Herb-Roasted Chicken"));
    assert.equal(names.includes("Chiavari Chair"), false);
    assert.equal(starterFixedLineNames(reception).includes("Day-of Coordination"), false);
    const ceremony = getEventOrderStarterMaster("EO-D-02")!;
    assert.ok(starterChoiceOptionNames(ceremony).includes("Ceremony Coordination"));
    assert.ok(starterChoiceOptionNames(ceremony).includes("Arbor"));
    assert.equal(starterFixedLineNames(ceremony).includes("Ceremony Coordination"), false);
    const src = readFileSync(join(root, "lib/event-order-templates/starters.ts"), "utf8");
    assert.doesNotMatch(src, /unitPrice:\s*1200/);
    assert.doesNotMatch(src, /unitPrice:\s*85/);
    assert.doesNotMatch(src, /unitPrice:\s*350/);
    assert.doesNotMatch(src, /unitPrice:\s*500/);
  });

  it("B. removing an example offering drops it from preview and readiness", () => {
    const original = newVenueUnconfiguredStarterTemplate();
    assert.ok(optionByLabel(original, "Farm Table"));
    const removed = removeOptionByLabel(original, "Farm Table");
    assert.equal(optionByLabel(removed, "Farm Table"), undefined);
    const guidance = groupedCompletenessGuidance(removed.sections, removed.groups, removed.options);
    const text = guidance.flatMap((s) => s.lines.map((l) => l.text)).join(" ");
    assert.equal(text.includes("Farm Table"), false);
    const definition = selectionDefinitionFromEventOrderTemplate(removed);
    assert.equal(definition.options.some((o) => o.label === "Farm Table"), false);
  });

  it("C. Included offering shows Included and adds no charge", () => {
    const template = configureOption(newVenueUnconfiguredStarterTemplate(), "Herb-Roasted Chicken", {
      isIncluded: true,
      unitPrice: 0,
    });
    const chicken = optionByLabel(template, "Herb-Roasted Chicken")!;
    assert.equal(venueCommercialLabel(chicken), "Included");
    assert.equal(clientCommercialLabel(chicken, false, "client"), "Included");
    const definition = selectionDefinitionFromEventOrderTemplate(template);
    const plated = optionByLabel(template, "Plated Dinner")!;
    const dinner = template.groups.find((g) => g.name === "Dinner service")!;
    const entrees = template.groups.find(
      (g) => g.name === "Entrées" && (g.dependsOnOptionIds ?? []).includes(plated.id),
    )!;
    let { answers } = toggleChoiceOption(definition, {}, dinner.id, plated.id);
    answers = toggleChoiceOption(definition, answers, entrees.id, chicken.id).answers;
    const lines = resolveSelectedOptions(definition, answers);
    const chickenLine = lines.find((l) => l.optionId === chicken.id)!;
    assert.equal(chickenLine.isIncluded, true);
    assert.equal(chickenLine.amount, 0);
    assert.equal(financialDeltaFromLines(lines.filter((l) => l.optionId === chicken.id)), 0);
  });

  it("D. Day-of Coordination Additional $1,200 fixture selects and deselects without double counting", () => {
    const template = dayOfCoordinationAdditionalFixture();
    const dayOf = optionByLabel(template, "Day-of Coordination")!;
    assert.equal(dayOf.unitPrice, 1200);
    assert.equal(choiceOptionPriceLabel(dayOf, false, "preview"), "+$1200");
    const definition = selectionDefinitionFromEventOrderTemplate(template);
    const services = template.groups.find((g) => g.name === "Optional services")!;
    const none = resolveSelectedOptions(definition, {});
    assert.equal(none.some((l) => l.optionId === dayOf.id), false);
    const selected = toggleChoiceOption(definition, {}, services.id, dayOf.id).answers;
    const selectedLines = resolveSelectedOptions(definition, selected);
    const dayLines = selectedLines.filter((l) => l.optionId === dayOf.id);
    assert.equal(dayLines.length, 1);
    assert.equal(dayLines[0]?.amount, 1200);
    assert.equal(financialDeltaFromLines(dayLines), 1200);
    const removed = toggleChoiceOption(definition, selected, services.id, dayOf.id).answers;
    assert.equal(resolveSelectedOptions(definition, removed).some((l) => l.optionId === dayOf.id), false);
  });
});

describe("Checkpoint 3B parent/child pricing", () => {
  it("E. priced parent with included children does not double count", () => {
    const template = pricedParentChildFixture();
    const definition = selectionDefinitionFromEventOrderTemplate(template);
    let { answers } = toggleChoiceOption(definition, {}, "g-dinner", "opt-plated");
    answers = toggleChoiceOption(definition, answers, "g-entrees", "opt-chicken").answers;
    const lines = resolveSelectedOptions(definition, answers, { guestCount: 10 });
    assert.equal(lines.find((l) => l.optionId === "opt-plated")?.amount, 850);
    assert.equal(lines.find((l) => l.optionId === "opt-chicken")?.isIncluded, true);
    assert.equal(lines.find((l) => l.optionId === "opt-chicken")?.amount, 0);
    assert.equal(financialDeltaFromLines(lines), 850);
  });

  it("F. priced parent with a paid child upgrade does not double count the parent", () => {
    const template = pricedParentChildFixture();
    const definition = selectionDefinitionFromEventOrderTemplate(template);
    let { answers } = toggleChoiceOption(definition, {}, "g-dinner", "opt-plated");
    answers = toggleChoiceOption(definition, answers, "g-entrees", "opt-filet").answers;
    const lines = resolveSelectedOptions(definition, answers, { guestCount: 10 });
    assert.equal(lines.find((l) => l.optionId === "opt-plated")?.amount, 850);
    assert.equal(lines.find((l) => l.optionId === "opt-filet")?.amount, 150);
    assert.equal(financialDeltaFromLines(lines), 1000);
    assert.equal(choiceOptionPriceLabel(template.options.find((o) => o.id === "opt-filet")!, false), "+$15 per person");
    assert.equal(choiceOptionPriceLabel(template.options.find((o) => o.id === "opt-chicken")!, false), "Included");
  });
});

describe("Checkpoint 3B readiness and labels", () => {
  it("G. unconfigured is identified as Not configured, never Included or free", () => {
    const opt = { isIncluded: false, unitPrice: null as number | null };
    assert.equal(commercialState(opt), "not_configured");
    assert.equal(venueCommercialLabel(opt), "Not configured");
    assert.equal(packageBuilderPriceLabel(null, false), "Not configured");
    assert.equal(packageBuilderPriceLabel(null, true), "Included");
    assert.equal(packageBuilderPriceLabel(1200, false), "Additional · $1200");
    assert.doesNotMatch(venueCommercialLabel(opt), /Additional|Included|Free|\$0/);
  });

  it("H. release and submit are blocked while commercial configuration is unresolved", () => {
    const template = newVenueUnconfiguredStarterTemplate();
    const definition = selectionDefinitionFromEventOrderTemplate(template);
    const blocked = unanswerableChoicesSendMessage(definition);
    assert.match(blocked ?? "", /not configured/i);
    const plated = optionByLabel(template, "Plated Dinner")!;
    const dinner = template.groups.find((g) => g.name === "Dinner service")!;
    const { answers } = toggleChoiceOption(definition, {}, dinner.id, plated.id);
    const submitted = validateChoicesAnswers(definition, answers);
    assert.equal(submitted.ok, false);
    assert.match(submitted.ok ? "" : submitted.message, /not configured/i);
    const send = readFileSync(join(root, "lib/client-choices/service.ts"), "utf8");
    assert.match(send, /unanswerableChoicesSendMessage/);
    const actions = readFileSync(join(root, "app/(app)/events/[id]/event-order-actions.ts"), "utf8");
    const sendFn = actions.slice(actions.indexOf("export async function sendEventOrderToCoupleAction"));
    assert.ok(
      sendFn.indexOf("eventOrderShareChoicesBlocker") > 0 &&
        sendFn.indexOf("eventOrderShareChoicesBlocker") < sendFn.indexOf("finalizeEventOrder"),
    );
  });

  it("I. switching Plated to Buffet drops inactive answers and charges", () => {
    const template = pricedParentChildFixture();
    const definition = selectionDefinitionFromEventOrderTemplate(template);
    let { answers } = toggleChoiceOption(definition, {}, "g-dinner", "opt-plated");
    answers = toggleChoiceOption(definition, answers, "g-entrees", "opt-filet").answers;
    assert.ok(resolveSelectedOptions(definition, answers).some((l) => l.optionId === "opt-filet"));
    // Starter switching is covered with the unconfigured starter dinner pair.
    const starter = newVenueUnconfiguredStarterTemplate();
    const starterDef = selectionDefinitionFromEventOrderTemplate(starter);
    const dinner = starter.groups.find((g) => g.name === "Dinner service")!;
    const plated = optionByLabel(starter, "Plated Dinner")!;
    const buffet = optionByLabel(starter, "Buffet Dinner")!;
    const chicken = optionByLabel(starter, "Herb-Roasted Chicken")!;
    const platedEntrees = starter.groups.find(
      (g) => g.name === "Entrées" && (g.dependsOnOptionIds ?? []).includes(plated.id),
    )!;
    let next = toggleChoiceOption(starterDef, {}, dinner.id, plated.id).answers;
    next = toggleChoiceOption(starterDef, next, platedEntrees.id, chicken.id).answers;
    next = toggleChoiceOption(starterDef, next, dinner.id, buffet.id).answers;
    const lines = resolveSelectedOptions(starterDef, next);
    assert.equal(lines.some((l) => l.optionId === chicken.id), false);
    assert.ok(lines.some((l) => l.optionId === buffet.id));
  });

  it("groups completeness warnings by hierarchy instead of repeating identical bullets", () => {
    const template = newVenueUnconfiguredStarterTemplate();
    const guidance = groupedCompletenessGuidance(template.sections, template.groups, template.options);
    assert.equal(COMPLETENESS_INTRO, "This template needs a few decisions before it can be shared.");
    const catering = guidance.find((s) => s.sectionName === "Catering");
    assert.ok(catering);
    const texts = catering!.lines.map((l) => l.text);
    assert.ok(texts.some((t) => t.includes("Plated Dinner:") && t.includes("Entrées") && t.includes("Sides")));
    assert.ok(texts.some((t) => t.includes("Buffet Dinner:") && t.includes("Entrées")));
    assert.equal(texts.filter((t) => t === "Entrées still needs a price or an Included decision.").length, 0);
    const preview = readFileSync(
      join(root, "components/event-order-templates/event-order-client-preview.tsx"),
      "utf8",
    );
    const guidanceUi = readFileSync(
      join(root, "components/event-order-templates/event-order-completeness-guidance.tsx"),
      "utf8",
    );
    assert.match(preview, /EventOrderCompletenessGuidance/);
    assert.match(guidanceUi, /COMPLETENESS_INTRO/);
    assert.match(guidanceUi, /groupedCompletenessGuidance/);
  });

  it("selection-rule wording follows stored min/max", () => {
    assert.equal(
      selectionRuleLabel({ selectionMode: "multi", minSelect: 0, maxSelect: 2 }),
      "Choose up to 2 · Optional",
    );
    assert.equal(
      selectionRuleLabel({ selectionMode: "single", minSelect: 1, maxSelect: 1 }),
      "Choose 1 · Required",
    );
    assert.equal(
      selectionRuleLabel({ selectionMode: "multi", minSelect: 1, maxSelect: 2 }),
      "Choose 1–2 · Required",
    );
    assert.equal(
      selectionRuleLabel({ selectionMode: "single", minSelect: 0, maxSelect: 1 }),
      "Choose 1 or skip · Optional",
    );
    assert.equal(
      simpleSelectionLabel({
        selectionMode: "multi",
        minSelect: 0,
        maxSelect: 2,
        allowQuantity: false,
      }),
      "Choose up to 2 · Optional",
    );
    assert.equal(
      plainSelectionRuleLabel({ selectionMode: "multi", minSelect: 0, maxSelect: 2 }),
      "Choose up to 2 · Optional",
    );
    const partial = selectionProgressForGroup(
      { selectionMode: "multi", minSelect: 0, maxSelect: 2 },
      1,
    );
    assert.equal(partial.requirementMet, true);
    assert.match(selectionProgressLabel({ selectionMode: "multi", minSelect: 0, maxSelect: 2 }, 1), /Choose up to 2 · Optional/);
    const template = newVenueUnconfiguredStarterTemplate();
    const dinner = template.groups.find((g) => g.name === "Dinner service")!;
    const plated = optionByLabel(template, "Plated Dinner")!;
    const sides = template.groups.find(
      (g) => g.name === "Sides" && (g.dependsOnOptionIds ?? []).includes(plated.id),
    )!;
    const entrees = template.groups.find(
      (g) => g.name === "Entrées" && (g.dependsOnOptionIds ?? []).includes(plated.id),
    )!;
    const buffet = optionByLabel(template, "Buffet Dinner")!;
    const buffetEntrees = template.groups.find(
      (g) => g.name === "Entrées" && (g.dependsOnOptionIds ?? []).includes(buffet.id),
    )!;
    const desserts = template.groups.find(
      (g) => g.name === "Desserts" && (g.dependsOnOptionIds ?? []).includes(plated.id),
    )!;
    assert.equal(simpleSelectionLabel(dinner), "Choose 1 · Required");
    assert.equal(simpleSelectionLabel(entrees), "Choose 1 · Required");
    assert.equal(simpleSelectionLabel(sides), "Choose up to 2 · Optional");
    assert.equal(simpleSelectionLabel(desserts), "Choose 1 or skip · Optional");
    assert.equal(simpleSelectionLabel(buffetEntrees), "Choose 1–2 · Required");
    const definition = selectionDefinitionFromEventOrderTemplate(template);
    const oneSide = {
      [dinner.id]: { optionIds: [plated.id] },
      [entrees.id]: { optionIds: [optionByLabel(template, "Herb-Roasted Chicken")!.id] },
      [sides.id]: { optionIds: [optionByLabel(template, "Roasted Potatoes")!.id] },
    };
    // Commercial gate still blocks unconfigured; selection count of 1-of-2 is allowed.
    const countOnly = { ...definition, options: definition.options.map((o) => ({ ...o, isIncluded: true, unitPrice: 0 })) };
    const result = validateChoicesAnswers(countOnly, oneSide);
    assert.equal(result.ok, false); // dinner/bar still required and other groups unselected
    const bar = template.groups.find((g) => g.name === "Bar package")!;
    const beerWine = optionByLabel(template, "Beer & Wine")!;
    const enough = {
      ...oneSide,
      [bar.id]: { optionIds: [beerWine.id] },
    };
    assert.equal(validateChoicesAnswers(countOnly, enough).ok, true);
  });
});

describe("Checkpoint 3B provisioning and snapshot safety", () => {
  it("K. existing venue copies keep customized prices and inclusions", () => {
    const existing = existingVenueCustomizedCopyFixture();
    const farm = optionByLabel(existing, "Farm Table")!;
    const dayOf = optionByLabel(existing, "Day-of Coordination")!;
    assert.equal(farm.unitPrice, 85);
    assert.equal(dayOf.isIncluded, true);
    const source = newVenueUnconfiguredStarterTemplate();
    assert.equal(optionByLabel(source, "Farm Table")!.unitPrice, null);
    assert.equal(optionByLabel(source, "Day-of Coordination")!.isIncluded, false);
    assert.equal(farm.unitPrice, 85);
    assert.equal(dayOf.isIncluded, true);
    const provision = readFileSync(join(root, "lib/event-order-templates/provision.ts"), "utf8");
    assert.match(provision, /group.options.length > 0/);
    assert.match(provision, /already_has_groups/);
    assert.match(provision, /skipped.push\(master.key\)/);
  });

  it("preview uses a wider readable column and grouped completeness", () => {
    const page = readFileSync(
      join(root, "app/(app)/library/event-order-templates/[id]/preview/page.tsx"),
      "utf8",
    );
    assert.match(page, /max-w-3xl/);
    assert.doesNotMatch(page, /contentMaxWidthClassName="max-w-xl"/);
    const form = readFileSync(join(root, "components/client-choices/choices-interactive-form.tsx"), "utf8");
    assert.match(form, /priceSurface/);
  });

  it("does not connect Event Order starters to Inventory stock automatically", () => {
    const starters = readFileSync(join(root, "lib/event-order-templates/starters.ts"), "utf8");
    assert.match(starters, /Inventory stock is a separate system/);
    assert.doesNotMatch(starters, /inventoryItemId/);
  });
});
