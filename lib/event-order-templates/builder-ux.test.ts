/**
 * Source seams for guided EO Template setup + category Offering picker.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

const root = process.cwd();

describe("EO template builder — guided setup UX seams", () => {
  it("detail hosts a compact template overview, not the expanded wizard", () => {
    const detail = readFileSync(
      join(root, "components/event-order-templates/event-order-template-detail.tsx"),
      "utf8",
    );
    assert.match(detail, /EventOrderTemplateOverview/);
    assert.doesNotMatch(detail, /GuidedSetupWizard/);
    assert.match(detail, /eo-template-detail-intro/);
    assert.match(detail, /Preview as Client/);
    assert.match(detail, /Use \/ Send/);
    assert.match(detail, /eo-template-readiness/);
    assert.doesNotMatch(detail, /follow-ups under each answer/i);
    assert.doesNotMatch(detail, /commercial build sheet/i);
  });

  it("landing page explains templates without jargon-heavy intro", () => {
    const page = readFileSync(
      join(root, "app/(app)/library/event-order-templates/page.tsx"),
      "utf8",
    );
    assert.match(page, /Create and manage reusable client selection experiences/);
    assert.match(page, /eo-templates-landing-example/);
    assert.match(page, /Offerings Catalog/);
    assert.match(page, /Preview shows[\s\S]*the client experience without sending/i);
    assert.doesNotMatch(page, /commercial build sheets/i);
    assert.doesNotMatch(page, /follow-ups under each answer/i);
  });

  it("overview shows compact section cards; focused section editor is a dedicated route", () => {
    const overview = readFileSync(
      join(root, "components/event-order-templates/event-order-template-overview.tsx"),
      "utf8",
    );
    const section = readFileSync(
      join(root, "components/event-order-templates/event-order-section-editor.tsx"),
      "utf8",
    );
    const route = readFileSync(
      join(root, "app/(app)/library/event-order-templates/[id]/sections/[sectionId]/page.tsx"),
      "utf8",
    );
    assert.match(overview, /eo-template-overview/);
    assert.match(overview, /eo-overview-edit-/);
    assert.match(overview, />\s*Edit\s*</);
    assert.match(overview, /sectionOverviewSummary/);
    assert.match(overview, /htc-working-row/);
    assert.doesNotMatch(overview, /htc-working-card/);
    assert.doesNotMatch(overview, /PackageChoicesPanel/);
    assert.match(section, /What's included|What&apos;s included/);
    assert.match(section, /What clients can choose/);
    assert.match(section, /Advanced settings/);
    assert.match(section, /presentation="progressive"/);
    assert.match(route, /EventOrderSectionEditor/);
    assert.doesNotMatch(section, /depends_on_option_ids/);
    assert.doesNotMatch(overview, /How should clients make their selections/);
  });

  it("ordinary guided flow uses Offering package choices; specialist rules stay collapsed", () => {
    const groups = readFileSync(
      join(root, "components/event-order-templates/event-order-template-choice-groups.tsx"),
      "utf8",
    );
    const section = readFileSync(
      join(root, "components/event-order-templates/event-order-section-editor.tsx"),
      "utf8",
    );
    const panel = readFileSync(
      join(root, "components/event-order-templates/package-choices-panel.tsx"),
      "utf8",
    );
    assert.match(groups, /More settings/);
    assert.match(groups, /specialistMode/);
    assert.match(section, /PackageChoicesPanel/);
    assert.match(section, /specialistMode/);
    assert.match(panel, /eo-package-choices-panel/);
    assert.match(panel, /CategorizedOfferingSelect/);
    assert.match(panel, /authoringScope=\{\{ kind: "primary" \}\}/);
    assert.match(panel, /presentation === "progressive"/);
  });

  it("ordinary guided catering flow is Offering-first — no question-builder step", () => {
    const section = readFileSync(
      join(root, "components/event-order-templates/event-order-section-editor.tsx"),
      "utf8",
    );
    const panel = readFileSync(
      join(root, "components/event-order-templates/package-choices-panel.tsx"),
      "utf8",
    );
    assert.match(section, /Items provided as part of the event/);
    assert.match(section, /What clients can choose/);
    assert.match(panel, /eo-couple-choice-offering-select/);
    assert.match(panel, /categories the couple picks from/);
    assert.match(panel, /SelectionRuleControls/);
    assert.match(panel, /SimpleSelectionRuleControls/);
    assert.match(panel, /eo-level-1-choice/);
    assert.match(panel, /eo-level-2-categories/);
    assert.match(panel, /eo-level-3-offerings/);
    assert.match(panel, /Add write-in option/);
    assert.match(panel, /Add item/);
    assert.match(panel, /Add an offering/);
    assert.match(panel, /Add a category from Offerings|Create category/);
    assert.doesNotMatch(panel, /How many from this group\?/);
    assert.match(panel, /eo-add-choice-set/);
    assert.match(panel, /CatalogPickerDisclosure/);
    assert.match(panel, /Choose from your offerings/);
    assert.match(section, /editorLevelCopy/);
    assert.match(section, /max-w-3xl/);
    assert.match(panel, /parentChoiceView/);
    assert.match(panel, /optionInputFromOffering/);
    assert.doesNotMatch(section, /Add a primary question/);
    assert.doesNotMatch(panel, /Add a primary question/);
    assert.doesNotMatch(panel, /follow-up question/i);
  });

  it("overview cards stay collapsed; advanced settings stay under the section editor", () => {
    const overview = readFileSync(
      join(root, "components/event-order-templates/event-order-template-overview.tsx"),
      "utf8",
    );
    const section = readFileSync(
      join(root, "components/event-order-templates/event-order-section-editor.tsx"),
      "utf8",
    );
    assert.match(overview, /data-section-expanded="false"/);
    assert.match(overview, /eo-overview-edit-/);
    assert.match(section, /Advanced settings/);
    assert.match(section, /eo-specialist-selection-rules/);
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
