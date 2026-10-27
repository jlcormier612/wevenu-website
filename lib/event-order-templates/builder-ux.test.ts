/**
 * Source seams for guided EO Template setup + category Offering picker.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

const root = process.cwd();

describe("EO template builder — guided setup UX seams", () => {
  it("detail hosts the guided setup wizard with plain-language orientation", () => {
    const detail = readFileSync(
      join(root, "components/event-order-templates/event-order-template-detail.tsx"),
      "utf8",
    );
    assert.match(detail, /GuidedSetupWizard/);
    assert.match(detail, /eo-template-detail-intro/);
    assert.match(detail, /included automatically/i);
    assert.match(detail, /follow-up questions nested under each option/i);
    assert.doesNotMatch(detail, /commercial build sheet/i);
  });

  it("landing page explains templates without jargon-heavy intro", () => {
    const page = readFileSync(
      join(root, "app/(app)/library/event-order-templates/page.tsx"),
      "utf8",
    );
    assert.match(page, /Reusable packages for a wedding/i);
    assert.match(page, /eo-templates-landing-example/);
    assert.match(page, /included automatically/i);
    assert.match(page, /Preview shows the couple experience without sending/i);
    assert.doesNotMatch(page, /commercial build sheets/i);
  });

  it("wizard covers categories → workspace → review → preview without pattern quiz", () => {
    const wizard = readFileSync(
      join(root, "components/event-order-templates/guided-setup-wizard.tsx"),
      "utf8",
    );
    assert.match(wizard, /eo-guided-setup-wizard/);
    assert.match(wizard, /eo-guided-step-categories/);
    assert.match(wizard, /eo-guided-step-workspace/);
    assert.match(wizard, /eo-guided-step-fixed/);
    assert.match(wizard, /eo-guided-step-choices/);
    assert.match(wizard, /eo-guided-step-review/);
    assert.match(wizard, /eo-guided-step-preview/);
    assert.match(wizard, /What does this package include/);
    assert.match(wizard, /Set up \{activeSection\.name\}/);
    assert.match(wizard, /Specialist selection rules/);
    assert.match(wizard, /eo-specialist-selection-rules/);
    assert.match(wizard, /eo-guided-preview-non-sending/);
    assert.match(wizard, /Preview only — no send, no finalize/);
    assert.match(wizard, /phase !== "preview"/);
    assert.doesNotMatch(wizard, /eo-guided-step-patterns/);
    assert.doesNotMatch(wizard, /eo-guided-step-branches/);
    assert.doesNotMatch(wizard, /How should clients make their selections/);
    assert.doesNotMatch(wizard, /What happens when a client selects this option/);
    assert.doesNotMatch(wizard, /Step 1 of 7/);
    assert.doesNotMatch(wizard, /depends_on_option_ids/);
    assert.doesNotMatch(wizard, /Advanced editor/i);
    assert.doesNotMatch(wizard, /patternDraftBySection/);
    assert.doesNotMatch(wizard, /eo-guided-pattern-choose_one/);
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
    assert.match(wizard, /nestBranches/);
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
    assert.match(wizard, /Choices for \{activeSection\.name\}/);
    assert.match(wizard, /categories belong under each option/i);
    assert.match(wizard, /Under each option, add the follow-up categories/i);
  });

  it("preview validates under-selection with the shared choices validator", () => {
    const groups = readFileSync(
      join(root, "components/event-order-templates/event-order-template-choice-groups.tsx"),
      "utf8",
    );
    assert.match(groups, /validateChoicesAnswers/);
    assert.match(groups, /eo-preview-check-selections/);
    assert.match(groups, /eo-preview-validation-message/);
    assert.match(groups, /orderedVisibleChoiceGroups/);
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
