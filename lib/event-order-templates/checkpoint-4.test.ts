/**
 * Checkpoint 4 — end-to-end acceptance coverage on isolated fixtures.
 * Does not write venue, invoice, inventory, or Sandbox records.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

import {
  financialDeltaFromLines,
  resolveSelectedOptions,
} from "@/lib/client-choices/apply-to-event-order";
import { toggleChoiceOption } from "@/lib/client-choices/interactive-selection";
import {
  unanswerableChoicesSendMessage,
  validateChoicesAnswers,
} from "@/lib/client-choices/validate-answers";
import { isPublicPath } from "@/integrations/supabase/proxy";
import {
  groupedCompletenessGuidance,
} from "@/lib/event-order-templates/commercial-state";
import { selectionDefinitionFromEventOrderTemplate } from "@/lib/event-order-templates/selection-definition";
import {
  configureOption,
  existingVenueCustomizedCopyFixture,
  newVenueUnconfiguredStarterTemplate,
  pricedParentChildFixture,
  removeOptionByLabel,
  removeSectionByName,
} from "@/lib/event-order-templates/checkpoint-3b-fixtures";

const root = join(process.cwd());

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("Checkpoint 4 public surface", () => {
  it("does not expose the Checkpoint 3B fixture route as a public path", () => {
    assert.equal(isPublicPath("/c3b-fixture-preview"), false);
    assert.equal(isPublicPath("/c3b-fixture-preview/"), false);
    assert.doesNotMatch(source("integrations/supabase/proxy.ts"), /c3b-fixture-preview/);
    assert.equal(existsSync(join(root, "app/c3b-fixture-preview")), false);
  });
});

describe("Checkpoint 4 commercial handoff", () => {
  it("priced parent with included child is $850 for 10 guests", () => {
    const template = pricedParentChildFixture();
    const definition = selectionDefinitionFromEventOrderTemplate(template);
    let { answers } = toggleChoiceOption(definition, {}, "g-dinner", "opt-plated");
    answers = toggleChoiceOption(definition, answers, "g-entrees", "opt-chicken").answers;
    const lines = resolveSelectedOptions(definition, answers, { guestCount: 10 });
    assert.equal(lines.find((l) => l.optionId === "opt-plated")?.amount, 850);
    assert.equal(lines.find((l) => l.optionId === "opt-chicken")?.amount, 0);
    assert.equal(financialDeltaFromLines(lines), 850);
  });

  it("priced parent with paid upgrade is $1000 for 10 guests", () => {
    const template = pricedParentChildFixture();
    const definition = selectionDefinitionFromEventOrderTemplate(template);
    let { answers } = toggleChoiceOption(definition, {}, "g-dinner", "opt-plated");
    answers = toggleChoiceOption(definition, answers, "g-entrees", "opt-filet").answers;
    const lines = resolveSelectedOptions(definition, answers, { guestCount: 10 });
    assert.equal(financialDeltaFromLines(lines), 1000);
  });

  it("Day-of Coordination $1200 is a flat fee and is not multiplied by guests", () => {
    const template = configureOption(newVenueUnconfiguredStarterTemplate(), "Day-of Coordination", {
      isIncluded: false,
      unitPrice: 1200,
    });
    const definition = selectionDefinitionFromEventOrderTemplate(template);
    const services = template.groups.find((g) => g.name === "Optional services")!;
    const dayOf = template.options.find((o) => o.label === "Day-of Coordination")!;
    const none = resolveSelectedOptions(definition, {}, { guestCount: 10 });
    assert.equal(none.some((l) => l.optionId === dayOf.id), false);
    const selected = toggleChoiceOption(definition, {}, services.id, dayOf.id).answers;
    const lines = resolveSelectedOptions(definition, selected, { guestCount: 10 });
    const dayLines = lines.filter((l) => l.optionId === dayOf.id);
    assert.equal(dayLines.length, 1);
    assert.equal(dayLines[0]?.quantity, 1);
    assert.equal(dayLines[0]?.boundToHeadcount, false);
    assert.equal(dayLines[0]?.amount, 1200);
    assert.equal(financialDeltaFromLines(dayLines), 1200);
  });

  it("quantity rental multiplies unit price by selected quantity once, not guest count", () => {
    const template = configureOption(newVenueUnconfiguredStarterTemplate(), "Farm Table", {
      isIncluded: false,
      unitPrice: 85,
    });
    const definition = selectionDefinitionFromEventOrderTemplate(template);
    const rentals = template.groups.find((g) => g.name === "Optional rentals")!;
    const farm = template.options.find((o) => o.label === "Farm Table")!;
    assert.equal(rentals.allowQuantity, true);
    const answers = {
      [rentals.id]: { optionIds: [farm.id], quantities: { [farm.id]: 3 } },
    };
    const lines = resolveSelectedOptions(definition, answers, { guestCount: 10 });
    const farmLine = lines.find((l) => l.optionId === farm.id)!;
    assert.equal(farmLine.quantity, 3);
    assert.equal(farmLine.boundToHeadcount, false);
    assert.equal(farmLine.amount, 255);
    assert.equal(financialDeltaFromLines([farmLine]), 255);
  });

  it("inactive plated answers do not remain billable after switching to buffet", () => {
    const template = pricedParentChildFixture();
    const definition = selectionDefinitionFromEventOrderTemplate(template);
    let { answers } = toggleChoiceOption(definition, {}, "g-dinner", "opt-plated");
    answers = toggleChoiceOption(definition, answers, "g-entrees", "opt-filet").answers;
    const starter = newVenueUnconfiguredStarterTemplate();
    const starterDef = selectionDefinitionFromEventOrderTemplate(starter);
    const dinner = starter.groups.find((g) => g.name === "Dinner service")!;
    const plated = starter.options.find((o) => o.label === "Plated Dinner")!;
    const buffet = starter.options.find((o) => o.label === "Buffet Dinner")!;
    const chicken = starter.options.find((o) => o.label === "Herb-Roasted Chicken")!;
    const platedEntrees = starter.groups.find(
      (g) => g.name === "Entrées" && (g.dependsOnOptionIds ?? []).includes(plated.id),
    )!;
    let next = toggleChoiceOption(starterDef, {}, dinner.id, plated.id).answers;
    next = toggleChoiceOption(starterDef, next, platedEntrees.id, chicken.id).answers;
    next = toggleChoiceOption(starterDef, next, dinner.id, buffet.id).answers;
    const lines = resolveSelectedOptions(starterDef, next, { guestCount: 10 });
    assert.equal(lines.some((l) => l.optionId === chicken.id), false);
    assert.ok(lines.some((l) => l.optionId === buffet.id));
    assert.equal(answers["g-entrees"]?.optionIds.includes("opt-filet"), true);
  });
});

describe("Checkpoint 4 completeness after removals", () => {
  it("removing Bar, Rentals, and Services drops those completeness blockers", () => {
    let template = newVenueUnconfiguredStarterTemplate();
    template = removeSectionByName(template, "Bar");
    template = removeSectionByName(template, "Rentals");
    template = removeSectionByName(template, "Services");
    const guidance = groupedCompletenessGuidance(template.sections, template.groups, template.options);
    const text = guidance.flatMap((s) => s.lines.map((l) => l.text)).join(" ");
    assert.equal(text.includes("Bar"), false);
    assert.equal(text.includes("Farm Table"), false);
    assert.equal(text.includes("Day-of Coordination"), false);
    assert.ok(text.includes("Plated Dinner"));
    const definition = selectionDefinitionFromEventOrderTemplate(template);
    assert.equal(definition.groups.some((g) => g.name === "Bar package"), false);
  });

  it("removing an optional offering no longer blocks readiness for that offering", () => {
    const template = removeOptionByLabel(newVenueUnconfiguredStarterTemplate(), "Day-of Coordination");
    const guidance = groupedCompletenessGuidance(template.sections, template.groups, template.options);
    const text = guidance.flatMap((s) => s.lines.map((l) => l.text)).join(" ");
    assert.equal(text.includes("Day-of Coordination"), false);
  });

  it("unconfigured remaining offerings still block release", () => {
    const template = removeSectionByName(newVenueUnconfiguredStarterTemplate(), "Services");
    const blocked = unanswerableChoicesSendMessage(selectionDefinitionFromEventOrderTemplate(template));
    assert.match(blocked ?? "", /not configured/i);
  });
});

describe("Checkpoint 4 apply / invoice / inventory boundaries", () => {
  it("applying choices never creates an invoice", () => {
    const core = source("lib/client-choices/apply-core.ts");
    assert.match(core, /Never writes invoice/);
    assert.doesNotMatch(core, /createInvoice|insertFrozenLines|stripe/);
    const ensure = source("lib/event-orders/service.ts");
    const fnStart = ensure.indexOf("export async function ensureEventOrder");
    assert.match(ensure.slice(fnStart - 280, fnStart), /Does not create an invoice/);
    assert.doesNotMatch(ensure.slice(fnStart, fnStart + 1600), /createInvoice\(/);
  });

  it("already-shared Event Orders are not rewritten by template replace", () => {
    const service = source("lib/event-orders/service.ts");
    const replace = service.slice(service.indexOf("export async function replaceEventOrderFromTemplate"));
    assert.match(replace, /existing\.sharedAt/);
    assert.match(replace, /Template switch from setup is blocked/);
  });

  it("Event Order starters do not reserve inventory", () => {
    const starters = source("lib/event-order-templates/starters.ts");
    assert.match(starters, /Inventory stock is a separate system/);
    assert.doesNotMatch(starters, /inventoryItemId/);
    const preview = source("components/event-order-templates/event-order-client-preview.tsx");
    assert.doesNotMatch(preview, /reserveInventory|createReservation|inventory_reservations/);
  });

  it("existing venue copies keep customized prices when starter source is unpriced", () => {
    const existing = existingVenueCustomizedCopyFixture();
    const farm = existing.options.find((o) => o.label === "Farm Table")!;
    const sourceTemplate = newVenueUnconfiguredStarterTemplate();
    assert.equal(farm.unitPrice, 85);
    assert.equal(sourceTemplate.options.find((o) => o.label === "Farm Table")!.unitPrice, null);
  });

  it("selections are scoped to one definition; another event does not inherit answers", () => {
    const a = pricedParentChildFixture();
    const b = newVenueUnconfiguredStarterTemplate();
    const defA = selectionDefinitionFromEventOrderTemplate(a);
    const defB = selectionDefinitionFromEventOrderTemplate(b);
    const answersA = toggleChoiceOption(defA, {}, "g-dinner", "opt-plated").answers;
    const linesB = resolveSelectedOptions(defB, answersA as never, { guestCount: 10 });
    assert.equal(linesB.some((l) => l.optionId === "opt-plated"), false);
    const submitted = validateChoicesAnswers(defB, answersA as never);
    assert.equal(submitted.ok, false);
  });
});
