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
    assert.doesNotMatch(wizard, /depends_on_option_ids/);
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
