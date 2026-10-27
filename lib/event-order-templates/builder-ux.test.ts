/**
 * Source seams for guided EO Template setup + category Offering picker.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

const root = process.cwd();

describe("EO template builder — guided setup UX seams", () => {
  it("detail hosts the guided setup wizard", () => {
    const detail = readFileSync(
      join(root, "components/event-order-templates/event-order-template-detail.tsx"),
      "utf8",
    );
    assert.match(detail, /GuidedSetupWizard/);
    assert.match(detail, /guided setup asks what you offer/i);
  });

  it("wizard covers categories → patterns → choices → branches → review → preview", () => {
    const wizard = readFileSync(
      join(root, "components/event-order-templates/guided-setup-wizard.tsx"),
      "utf8",
    );
    assert.match(wizard, /eo-guided-setup-wizard/);
    assert.match(wizard, /eo-guided-step-categories/);
    assert.match(wizard, /eo-guided-step-patterns/);
    assert.match(wizard, /eo-guided-step-choices/);
    assert.match(wizard, /eo-guided-step-branches/);
    assert.match(wizard, /eo-guided-step-review/);
    assert.match(wizard, /eo-guided-step-preview/);
    assert.match(wizard, /What does your venue offer/);
    assert.match(wizard, /How should clients make their selections\?/);
    assert.match(wizard, /What happens when a client selects this option\?/);
    assert.match(wizard, /Nothing else — this is a complete choice/);
    assert.match(wizard, /Show additional options/);
    assert.match(wizard, /Specialist selection rules/);
    assert.match(wizard, /eo-specialist-selection-rules/);
    assert.match(wizard, /eo-guided-preview-non-sending/);
    assert.match(wizard, /Preview only — no send, no finalize/);
    assert.doesNotMatch(wizard, /depends_on_option_ids/);
    assert.doesNotMatch(wizard, /Advanced editor/i);
    assert.doesNotMatch(wizard, /eo-guided-pattern-choose_then_related/);
  });

  it("pattern copy distinguishes included, choose-one, multi, and optional extras", () => {
    const setup = readFileSync(
      join(root, "lib/event-order-templates/guided-setup.ts"),
      "utf8",
    );
    assert.match(setup, /Included automatically/);
    assert.match(setup, /Choose one option/);
    assert.match(setup, /Choose multiple options/);
    assert.match(setup, /Optional extras/);
    assert.match(
      setup,
      /Clients receive these items or services as part of their package/,
    );
    assert.match(
      setup,
      /Show any additional price before they choose/,
    );
    // Top-level choose_then_related card retired from CONFIG_PATTERNS list.
    assert.doesNotMatch(
      setup,
      /id: "choose_then_related",\s*\n\s*title:/,
    );
  });

  it("ordinary guided flow exposes More settings without requiring specialist rules", () => {
    const groups = readFileSync(
      join(root, "components/event-order-templates/event-order-template-choice-groups.tsx"),
      "utf8",
    );
    const wizard = readFileSync(
      join(root, "components/event-order-templates/guided-setup-wizard.tsx"),
      "utf8",
    );
    assert.match(groups, /More settings/);
    assert.match(groups, /guidedOrdinary/);
    assert.match(groups, /specialistMode/);
    assert.match(wizard, /guidedOrdinary/);
    assert.match(wizard, /specialistMode/);
    assert.match(wizard, /eo-guided-item-source-help/);
  });

  it("ordinary guided catering flow uses primary question + under-option follow-ups", () => {
    const groups = readFileSync(
      join(root, "components/event-order-templates/event-order-template-choice-groups.tsx"),
      "utf8",
    );
    const wizard = readFileSync(
      join(root, "components/event-order-templates/guided-setup-wizard.tsx"),
      "utf8",
    );
    assert.match(groups, /Add a primary question/);
    assert.match(groups, /How many can the couple select\?/);
    assert.match(groups, /Add choices for couples who select/);
    assert.match(groups, /eo-add-choices-for-/);
    assert.match(groups, /eo-select-count-/);
    assert.match(groups, /eo-add-primary-question/);
    assert.match(groups, /dependentCategoryGroupInput/);
    assert.match(groups, /resolvePlainSelectionRule/);
    assert.match(groups, /If the couple chooses/);
    assert.match(groups, /Clients answer this first/);
    assert.match(wizard, /Primary question/);
    assert.match(wizard, /Add choices for couples who select/);
  });

  it("offering and line editors explain Offerings vs Inventory vs template-only", () => {
    const sheet = readFileSync(
      join(root, "components/event-order-templates/offering-editor-sheet.tsx"),
      "utf8",
    );
    assert.match(sheet, /eo-line-source-help/);
    assert.match(sheet, /does not reserve stock/);
    assert.match(sheet, /never matched by name/);
    assert.match(sheet, /reusable Offerings list/);
  });

  it("pattern selections are owned per section and survive category tab changes", () => {
    const wizard = readFileSync(
      join(root, "components/event-order-templates/guided-setup-wizard.tsx"),
      "utf8",
    );
    assert.match(wizard, /patternDraftBySection/);
    assert.match(wizard, /seedPatternDraftsFromTemplate/);
    assert.match(wizard, /togglePatternInDraft/);
    assert.match(wizard, /patternsPayloadFromDrafts/);
    assert.match(wizard, /data-pattern-payload/);
    // Must not reset a single shared draft from detect on every active section change.
    assert.doesNotMatch(
      wizard,
      /setPatternDraft\(detectPatternsForSection/,
    );
  });

  it("empty Continue names the active category and does not wipe drafts on failure", () => {
    const wizard = readFileSync(
      join(root, "components/event-order-templates/guided-setup-wizard.tsx"),
      "utf8",
    );
    assert.match(
      wizard,
      /Select at least one way clients will experience \$\{activeSection\.name\}/,
    );
    // Validation / group-create failure paths return without clearing patternDraftBySection.
    assert.match(wizard, /if \(patternDraft\.length === 0\)/);
    assert.match(wizard, /Could not create choice group/);
    assert.doesNotMatch(wizard, /setPatternDraftBySection\(\s*\{\s*\}\s*\)/);
    assert.doesNotMatch(wizard, /setPatternDraftBySection\(\s*\(\)\s*=>\s*\{\s*\}\s*\)/);
  });

  it("choice groups nest branches and flag incomplete dependents", () => {
    const groups = readFileSync(
      join(root, "components/event-order-templates/event-order-template-choice-groups.tsx"),
      "utf8",
    );
    assert.match(groups, /dependentGroupsForOption/);
    assert.match(groups, /eo-incomplete-branch-/);
    assert.match(groups, /eo-section-completeness/);
    assert.match(groups, /CategorizedOfferingSelect/);
    assert.match(groups, /rootsOnly/);
    assert.doesNotMatch(groups, /matchOfferingByName|autoLinkByName/);
  });

  it("offering pickers stay category-filtered without silent all-catalog dump", () => {
    const picker = readFileSync(
      join(root, "components/event-order-templates/categorized-offering-select.tsx"),
      "utf8",
    );
    const sheet = readFileSync(
      join(root, "components/event-order-templates/offering-editor-sheet.tsx"),
      "utf8",
    );
    assert.match(picker, /eo-offering-category-filter/);
    assert.match(picker, /Suggested for/);
    assert.match(picker, /eo-offering-filter-empty/);
    assert.match(picker, /eo-offering-search/);
    assert.match(sheet, /CategorizedOfferingSelect/);
    assert.match(sheet, /never matched by name/);
  });
});
