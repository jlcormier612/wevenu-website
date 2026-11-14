/**
 * Checkpoint 2 — Preview as Client reuses the couple selection engine.
 * Isolated TEST FIXTURE data only. Does not write templates or catalog.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  financialDeltaFromLines,
  resolveSelectedOptions,
} from "@/lib/client-choices/apply-to-event-order";
import { orderedVisibleChoiceGroups } from "@/lib/client-choices/conditional-groups";
import { choiceOptionPriceLabel } from "@/lib/client-choices/price-labels";
import {
  toggleChoiceOption,
} from "@/lib/client-choices/interactive-selection";
import {
  incompleteStarterLikeTemplate,
  platedBuffetFixtureDefinition,
  platedBuffetFixtureTemplate,
  weddingReceptionStarterPreviewTemplate,
} from "@/lib/client-choices/preview-fixtures";
import { validateChoicesAnswers } from "@/lib/client-choices/validate-answers";
import { sectionCompletenessIssues } from "@/lib/event-order-templates/section-workspace";

const definition = platedBuffetFixtureDefinition();

function visibleNames(answers: Parameters<typeof orderedVisibleChoiceGroups>[1]) {
  return orderedVisibleChoiceGroups(definition, answers).map((g) => g.name);
}

function selectedIds(answers: ReturnType<typeof toggleChoiceOption>["answers"]) {
  return resolveSelectedOptions(definition, answers).map((l) => l.optionId).sort();
}

describe("Checkpoint 2 fixtures stay isolated", () => {
  it("labels plated/buffet examples as TEST FIXTURE, not starter data", () => {
    const template = platedBuffetFixtureTemplate();
    assert.match(template.name, /Fixture/);
    assert.match(template.description ?? "", /TEST FIXTURE/);
    assert.equal(template.id, "fixture-eo-c2");
    assert.equal(template.sourceMasterKey, null);
    const src = readFileSync(resolve("lib/client-choices/preview-fixtures.ts"), "utf8");
    assert.match(src, /not starter library data/);
    assert.doesNotMatch(src, /insertTemplate|updateTemplate|from\("event_order_templates"\)/);
  });
});

describe("Plated / Buffet conditional visibility", () => {
  it("A. initial state shows Dinner Service without dependent categories", () => {
    const names = visibleNames({});
    assert.deepEqual(names, ["Dinner Service", "Bar package"]);
    assert.equal(names.includes("Entrées"), false);
    assert.equal(names.includes("Buffet Entrées"), false);
  });

  it("A/E. independent Bar remains available without a dinner choice", () => {
    const names = visibleNames({});
    assert.ok(names.includes("Bar package"));
    assert.equal(names.includes("Extra seating"), false);
    assert.equal(names.includes("Chiavari Chair"), false);
  });

  it("B. Plated Dinner reveals plated categories only", () => {
    const { answers } = toggleChoiceOption(definition, {}, "g-dinner", "opt-plated");
    const names = visibleNames(answers);
    assert.ok(names.includes("Entrées"));
    assert.ok(names.includes("Sides"));
    assert.ok(names.includes("Desserts"));
    assert.equal(names.includes("Buffet Entrées"), false);
    assert.equal(names.includes("Buffet Sides"), false);
    assert.equal(names.includes("Buffet Desserts"), false);
    assert.ok(names.includes("Bar package"));
  });

  it("C. Buffet Dinner reveals buffet categories only", () => {
    const { answers } = toggleChoiceOption(definition, {}, "g-dinner", "opt-buffet");
    const names = visibleNames(answers);
    assert.ok(names.includes("Buffet Entrées"));
    assert.ok(names.includes("Buffet Sides"));
    assert.ok(names.includes("Buffet Desserts"));
    assert.equal(names.includes("Entrées"), false);
    assert.equal(names.includes("Sides"), false);
    assert.equal(names.includes("Desserts"), false);
  });

  it("C. switching Plated → Buffet drops plated answers from effective selection and totals", () => {
    let { answers } = toggleChoiceOption(definition, {}, "g-dinner", "opt-plated");
    answers = toggleChoiceOption(definition, answers, "g-plated-entrees", "opt-chicken").answers;
    answers = toggleChoiceOption(definition, answers, "g-plated-sides", "opt-potatoes").answers;
    answers = toggleChoiceOption(definition, answers, "g-plated-desserts", "opt-cake").answers;
    assert.ok(selectedIds(answers).includes("opt-chicken"));
    assert.ok(selectedIds(answers).includes("opt-cake"));
    const platedDelta = financialDeltaFromLines(resolveSelectedOptions(definition, answers));
    assert.equal(platedDelta, 91); // $85 plated + $6 cake

    answers = toggleChoiceOption(definition, answers, "g-dinner", "opt-buffet").answers;
    const ids = selectedIds(answers);
    assert.deepEqual(ids, ["opt-buffet"]);
    assert.equal(ids.includes("opt-chicken"), false);
    assert.equal(ids.includes("opt-cake"), false);
    assert.equal(answers["g-plated-entrees"], undefined);
    assert.equal(answers["g-plated-desserts"], undefined);
    assert.equal(financialDeltaFromLines(resolveSelectedOptions(definition, answers)), 72);
    const hiddenCheck = validateChoicesAnswers(definition, answers);
    assert.equal(hiddenCheck.ok, false); // buffet required categories still empty
    assert.match(hiddenCheck.ok ? "" : hiddenCheck.message, /Buffet Entrées/);
  });
});

describe("Selection rules on the shared engine", () => {
  it("D. choose-one replaces rather than stacking", () => {
    let { answers } = toggleChoiceOption(definition, {}, "g-dinner", "opt-plated");
    answers = toggleChoiceOption(definition, answers, "g-plated-entrees", "opt-chicken").answers;
    answers = toggleChoiceOption(definition, answers, "g-plated-entrees", "opt-beef").answers;
    assert.deepEqual(answers["g-plated-entrees"]?.optionIds, ["opt-beef"]);
  });

  it("D. choose-multiple honors max and reports a venue-friendly block", () => {
    let { answers } = toggleChoiceOption(definition, {}, "g-dinner", "opt-plated");
    answers = toggleChoiceOption(definition, answers, "g-plated-sides", "opt-potatoes").answers;
    answers = toggleChoiceOption(definition, answers, "g-plated-sides", "opt-veg-side").answers;
    const deny = {
      ...definition,
      options: [
        ...definition.options,
        {
          id: "opt-third-side",
          groupId: "g-plated-sides",
          offeringId: null,
          label: "TEST FIXTURE third side",
          description: null,
          isIncluded: true,
          unitPrice: 0,
          sortOrder: 9,
        },
      ],
    };
    const denied = toggleChoiceOption(deny, answers, "g-plated-sides", "opt-third-side");
    assert.match(denied.blockedMessage ?? "", /at most 2 selections|limited to 2/);
    assert.deepEqual(denied.answers["g-plated-sides"]?.optionIds, ["opt-potatoes", "opt-veg-side"]);
  });

  it("does not include Chiavari chairs or Extra seating inventory examples", () => {
    const template = platedBuffetFixtureTemplate();
    assert.equal(template.options.some((o) => /chiavari/i.test(o.label)), false);
    assert.equal(template.groups.some((g) => g.id === "g-chairs"), false);
    assert.equal(template.groups.some((g) => /extra seating/i.test(g.name)), false);
  });

  it("D. required plated path fails validation until entrée and sides are chosen", () => {
    const { answers } = toggleChoiceOption(definition, {}, "g-dinner", "opt-plated");
    const result = validateChoicesAnswers(definition, answers);
    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.message, /Entrées|Sides/);
  });

  it("D. optional dessert may be skipped", () => {
    let { answers } = toggleChoiceOption(definition, {}, "g-dinner", "opt-plated");
    answers = toggleChoiceOption(definition, answers, "g-plated-entrees", "opt-chicken").answers;
    answers = toggleChoiceOption(definition, answers, "g-plated-sides", "opt-potatoes").answers;
    const result = validateChoicesAnswers(definition, answers);
    assert.equal(result.ok, true);
  });
});

describe("Pricing and inclusion labels", () => {
  it("distinguishes included, per-person, additional, and quantity prices", () => {
    assert.equal(
      choiceOptionPriceLabel({ isIncluded: true, unitPrice: 0 }, false),
      "Included",
    );
    assert.equal(
      choiceOptionPriceLabel({
        isIncluded: false,
        unitPrice: 85,
        description: "Per person — TEST FIXTURE",
        pricingModel: "per_person",
      }, false),
      "+$85 per person",
    );
    assert.equal(
      choiceOptionPriceLabel({ isIncluded: false, unitPrice: 6 }, false),
      "+$6",
    );
    assert.equal(
      choiceOptionPriceLabel({ isIncluded: false, unitPrice: 8 }, true),
      "+$8 each",
    );
    assert.equal(
      choiceOptionPriceLabel({ isIncluded: false, unitPrice: null }, false),
      "Not available for release",
    );
  });

  it("hidden plated dessert does not contribute after switching to buffet", () => {
    let { answers } = toggleChoiceOption(definition, {}, "g-dinner", "opt-plated");
    answers = toggleChoiceOption(definition, answers, "g-plated-desserts", "opt-cake").answers;
    answers = toggleChoiceOption(definition, answers, "g-dinner", "opt-buffet").answers;
    const lines = resolveSelectedOptions(definition, answers);
    assert.equal(lines.some((l) => l.optionId === "opt-cake"), false);
    assert.equal(financialDeltaFromLines(lines), 72);
  });
});

describe("Incomplete templates stay honest", () => {
  it("does not fabricate nested offerings on the incomplete fixture", () => {
    const template = incompleteStarterLikeTemplate();
    assert.equal(template.options.filter((o) => o.groupId !== "g-dinner").length, 0);
    const issues = sectionCompletenessIssues(template.groups, template.options);
    assert.ok(issues.some((i) => i.message === "Plated Dinner needs at least one choice in Entrées."));
    assert.ok(issues.some((i) => i.message === "Plated Dinner needs at least one choice in Sides."));
    assert.ok(issues.some((i) => i.message === "Plated Dinner needs at least one choice in Desserts."));
  });

  it("Wedding Reception starter source populates plated/buffet branches without Chiavari", () => {
    const template = weddingReceptionStarterPreviewTemplate();
    assert.equal(template.name, "Wedding Reception");
    assert.match(template.description ?? "", /STARTER SOURCE PREVIEW/);
    assert.equal(template.options.some((o) => /chiavari/i.test(o.label)), false);
    const platedDinner = template.options.find((o) => o.label === "Plated Dinner");
    const buffetDinner = template.options.find((o) => o.label === "Buffet Dinner");
    assert.ok(platedDinner);
    assert.ok(buffetDinner);
    const platedEntrees = template.groups.find(
      (g) => g.name === "Entrées" && (g.dependsOnOptionIds ?? []).includes(platedDinner!.id),
    );
    const buffetEntrees = template.groups.find(
      (g) => g.name === "Entrées" && (g.dependsOnOptionIds ?? []).includes(buffetDinner!.id),
    );
    assert.ok(platedEntrees);
    assert.ok(buffetEntrees);
    assert.ok(template.options.some((o) => o.groupId === platedEntrees?.id && o.label === "Herb-Roasted Chicken"));
    assert.ok(template.options.some((o) => o.groupId === buffetEntrees?.id && o.label === "Roasted Chicken"));
    const issues = sectionCompletenessIssues(template.groups, template.options);
    assert.ok(issues.some((i) => i.kind === "unpriced-option" && i.groupName === "Dinner service"));
    assert.equal(issues.some((i) => i.kind === "empty-dependent"), false);
  });
});

describe("Preview and portal share the renderer without a second engine", () => {
  it("Preview as Client mounts the interactive form and does not persist", () => {
    const preview = readFileSync(
      resolve("components/event-order-templates/event-order-client-preview.tsx"),
      "utf8",
    );
    const page = readFileSync(
      resolve("app/(app)/library/event-order-templates/[id]/preview/page.tsx"),
      "utf8",
    );
    const form = readFileSync(
      resolve("components/client-choices/choices-interactive-form.tsx"),
      "utf8",
    );
    const portal = readFileSync(resolve("components/portal/choices-section.tsx"), "utf8");
    const composer = readFileSync(
      resolve("components/client-choices/client-choices-panel.tsx"),
      "utf8",
    );
    assert.match(page, /EventOrderClientPreview/);
    assert.doesNotMatch(page, /EventOrderTemplatePreviewView/);
    assert.match(preview, /ChoicesInteractiveForm/);
    assert.match(preview, /useState<ChoicesAnswers>\(\{\}\)/);
    assert.match(preview, /Client Preview/);
    assert.match(preview, /not saved, sent, or billed/);
    assert.doesNotMatch(preview, /\/api\/portal\/choices\/save/);
    assert.doesNotMatch(preview, /\/api\/portal\/choices\/submit/);
    assert.doesNotMatch(preview, /createInvoice|shareEventOrder|finalizeClientChoices/);
    assert.match(form, /orderedVisibleChoiceGroups/);
    assert.match(form, /toggleChoiceOption/);
    assert.match(portal, /ChoicesInteractiveForm/);
    assert.match(portal, /\/api\/portal\/choices\/save/);
    assert.match(portal, /\/api\/portal\/choices\/submit/);
    assert.match(composer, /EventOrderTemplatePreviewView/);
  });

  it("nested completeness warning is not rewritten to a generic parent message", () => {
    const editor = readFileSync(
      resolve("components/event-order-templates/event-order-section-editor.tsx"),
      "utf8",
    );
    assert.match(editor, /needs at least one choice/i);
  });
});
