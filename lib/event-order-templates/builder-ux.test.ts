/**
 * Source seams for category-first EO Template builder.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

const root = process.cwd();

describe("EO template builder — category-first UX seams", () => {
  it("detail uses section navigation and nests choice groups per section", () => {
    const detail = readFileSync(
      join(root, "components/event-order-templates/event-order-template-detail.tsx"),
      "utf8",
    );
    assert.match(detail, /eo-template-section-nav/);
    assert.match(detail, /lockedSectionId=\{section\.id\}/);
    assert.match(detail, /nestBranches/);
    assert.match(detail, /ConditionalChoicePreview/);
    assert.match(detail, /Commercial categories/);
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
    assert.doesNotMatch(groups, /matchOfferingByName|autoLinkByName/);
  });

  it("offering pickers are category-filtered without name-based linking", () => {
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
    assert.match(sheet, /CategorizedOfferingSelect/);
    assert.match(sheet, /never matched by name/);
  });
});
