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
    assert.match(detail, /always on the package/i);
    assert.match(detail, /Couple.*s choices|Offerings catalog/i);
    assert.doesNotMatch(detail, /follow-ups under each answer/i);
    assert.doesNotMatch(detail, /commercial build sheet/i);
    assert.doesNotMatch(detail, /included automatically/i);
  });

  it("landing page explains templates without jargon-heavy intro", () => {
    const page = readFileSync(
      join(root, "app/(app)/library/event-order-templates/page.tsx"),
      "utf8",
    );
    assert.match(page, /Reusable packages for a wedding/i);
    assert.match(page, /eo-templates-landing-example/);
    assert.match(page, /always-on items|always on the package/i);
    assert.match(page, /Offerings/i);
    assert.match(page, /Preview shows the couple experience without sending/i);
    assert.doesNotMatch(page, /commercial build sheets/i);
    assert.doesNotMatch(page, /follow-ups under each answer/i);
  });

  it("builder is one scrolling page — Included / Couple chooses / Add-ons per section, no pattern quiz", () => {
    const wizard = readFileSync(
      join(root, "components/event-order-templates/guided-setup-wizard.tsx"),
      "utf8",
    );
    const guided = readFileSync(
      join(root, "lib/event-order-templates/guided-setup.ts"),
      "utf8",
    );
    assert.match(wizard, /eo-guided-setup-wizard/);
    assert.match(wizard, /eo-guided-step-categories/);
    assert.match(wizard, /eo-guided-step-workspace/);
    assert.match(wizard, /eo-guided-step-fixed/);
    assert.match(wizard, /eo-guided-step-choices/);
    assert.match(wizard, /eo-guided-step-addons/);
    assert.match(wizard, /sectionsOrdered\.map\(\(section\)/);
    assert.match(wizard, /title="Included"/);
    assert.match(wizard, /Couple chooses/);
    assert.match(wizard, /title="Add-ons"/);
    assert.match(wizard, /Add section/);
    assert.match(wizard, /Specialist selection rules/);
    assert.match(wizard, /eo-specialist-selection-rules/);
    assert.match(wizard, /eo-guided-preview-non-sending/);
    assert.match(wizard, /Preview only — no send, no finalize/);
    assert.match(wizard, /\/library\/event-order-templates\/\$\{template\.id\}\/preview/);
    assert.match(wizard, /eo-guided-category-\$\{cat\.key\}/);
    assert.doesNotMatch(wizard, /setPhase|categoryIndex|eo-guided-continue/);
    assert.match(guided, /\| "ceremony"/);
    assert.match(guided, /key: "ceremony"/);
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

  it("ordinary guided flow uses Offering package choices; specialist rules stay collapsed", () => {
    const groups = readFileSync(
      join(root, "components/event-order-templates/event-order-template-choice-groups.tsx"),
      "utf8",
    );
    const wizard = readFileSync(
      join(root, "components/event-order-templates/guided-setup-wizard.tsx"),
      "utf8",
    );
    const panel = readFileSync(
      join(root, "components/event-order-templates/package-choices-panel.tsx"),
      "utf8",
    );
    assert.match(groups, /More settings/);
    assert.match(groups, /specialistMode/);
    assert.match(wizard, /PackageChoicesPanel/);
    assert.match(wizard, /specialistMode/);
    assert.match(wizard, /eo-package-choices-panel|PackageChoicesPanel/);
    assert.match(panel, /eo-package-choices-panel/);
    assert.match(panel, /CategorizedOfferingSelect/);
    assert.match(panel, /authoringScope=\{\{ kind: "primary" \}\}/);
    assert.doesNotMatch(wizard, /guidedOrdinary/);
  });

  it("ordinary guided catering flow is Offering-first — no question-builder step", () => {
    const wizard = readFileSync(
      join(root, "components/event-order-templates/guided-setup-wizard.tsx"),
      "utf8",
    );
    const panel = readFileSync(
      join(root, "components/event-order-templates/package-choices-panel.tsx"),
      "utf8",
    );
    assert.match(wizard, /Always on the package, covered by the package price/);
    assert.match(wizard, /Always on the package, billed as an extra charge/);
    assert.match(wizard, /Couple chooses/);
    assert.match(panel, /eo-couple-choice-offering-select/);
    assert.match(panel, /Dependent option groups/);
    assert.match(panel, /How many must the couple choose\?/);
    assert.match(panel, /Add write-in option/);
    assert.match(panel, /Add catalog option/);
    assert.match(panel, /Add selection group/);
    assert.doesNotMatch(panel, /How many from this group\?/);
    assert.match(panel, /Instructions for the couple/);
    assert.match(panel, /eo-add-choice-set/);
    assert.match(panel, /parentChoiceView/);
    assert.match(panel, /optionInputFromOffering/);
    assert.match(panel, /optionInputWriteIn/);
    assert.doesNotMatch(wizard, /Add a primary question/);
    assert.doesNotMatch(wizard, /Items always on this package/);
    assert.doesNotMatch(wizard, /Choices couples make/);
    assert.doesNotMatch(wizard, /Included in \{activeSection\.name\}/);
    assert.doesNotMatch(panel, /Add a primary question/);
    assert.doesNotMatch(panel, /follow-up question/i);
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

  it("offering and line editors explain Offerings vs template-only at the point of add", () => {
    const sheet = readFileSync(
      join(root, "components/event-order-templates/offering-editor-sheet.tsx"),
      "utf8",
    );
    assert.match(sheet, /eo-line-source-help/);
    assert.match(sheet, /From Offerings/);
    assert.match(sheet, /Template-only/);
    assert.match(sheet, /Covered by the package price/);
    assert.match(sheet, /Add package item/);
    assert.match(sheet, /Save package item/);
    assert.doesNotMatch(sheet, /"Add offering"/);
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
    assert.match(sheet, /snapshot/);
  });
});
