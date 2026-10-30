/**
 * Step 3 — Event Order reads as one document; the template builder is one page.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  isIncludedSetupLine,
  matchChoiceGroupsToSections,
  splitSetupLines,
  staffLineNotesLabel,
} from "@/lib/event-orders/document-view";
import { packageSelectionNotes } from "@/lib/event-orders/seed-package-inclusions";
import { matchSuggestedCategory } from "@/lib/event-order-templates/guided-setup";
import { EVENT_ORDER_STARTER_MASTERS, LEGACY_EVENT_ORDER_STARTER_KEYS } from "@/lib/event-order-templates/starters";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("line notes never show raw codes", () => {
  it("maps package and couple-selection stamps to plain English", () => {
    assert.equal(
      staffLineNotesLabel(packageSelectionNotes("11111111-1111-1111-1111-111111111111", "Signature Wedding")),
      "From package: Signature Wedding",
    );
    assert.equal(
      staffLineNotesLabel("choices:11111111-1111-1111-1111-111111111111:22222222-2222-2222-2222-222222222222"),
      "From the couple's selections",
    );
    assert.equal(staffLineNotesLabel("Gluten-free plate for table 4"), "Gluten-free plate for table 4");
    assert.equal(staffLineNotesLabel("  "), null);
    assert.equal(staffLineNotesLabel(null), null);
  });
});

describe("included setup items fold", () => {
  it("folds only zero-cost inventory lines", () => {
    assert.equal(isIncludedSetupLine({ provenance: "inventory", amount: 0 }), true);
    assert.equal(isIncludedSetupLine({ provenance: "inventory", amount: 150 }), false);
    assert.equal(isIncludedSetupLine({ provenance: "offering", amount: 0 }), false);
    assert.equal(isIncludedSetupLine({ provenance: "custom", amount: 0 }), false);
    const lines = [
      { id: "a", provenance: "offering" as const, amount: 0 },
      { id: "b", provenance: "inventory" as const, amount: 0 },
      { id: "c", provenance: "inventory" as const, amount: 40 },
    ];
    const { main, setup } = splitSetupLines(lines);
    assert.deepEqual(main.map((l) => l.id), ["a", "c"]);
    assert.deepEqual(setup.map((l) => l.id), ["b"]);
  });
});

describe("couple choices render once, inside their section", () => {
  it("matches groups to sections by name (case/space-insensitive); the rest stay unmatched", () => {
    const sections = [{ id: "s-cat", name: "Catering" }, { id: "s-bar", name: "Bar" }];
    const groups = [
      { id: "g1", sectionName: " catering " },
      { id: "g2", sectionName: "Bar" },
      { id: "g3", sectionName: "Florals" },
      { id: "g4", sectionName: null },
    ];
    const { bySectionId, unmatched } = matchChoiceGroupsToSections(groups, sections);
    assert.deepEqual(bySectionId.get("s-cat")?.map((g) => g.id), ["g1"]);
    assert.deepEqual(bySectionId.get("s-bar")?.map((g) => g.id), ["g2"]);
    assert.deepEqual(unmatched.map((g) => g.id), ["g3", "g4"]);
  });

  it("EO panel renders matched groups in sections and folds setup items", () => {
    const panel = read("components/event-orders/event-order-panel.tsx");
    assert.match(panel, /matchChoiceGroupsToSections\(coupleGroups, order\.sections\)/);
    assert.match(panel, /groupPlacement\.bySectionId\.get\(section\.id\)/);
    assert.match(panel, /unmatched=\{groupPlacement\.unmatched\}/);
    assert.match(panel, /Included setup items \(/);
    assert.match(panel, /eo-included-setup-items/);
    assert.match(panel, /staffLineNotesLabel\(line\.notes\)/);
    assert.doesNotMatch(panel, /PROVENANCE_LABEL/);
    assert.match(panel, /Link floor plan/);
    assert.doesNotMatch(panel, /Delivery subtotal \(for reference\)/);
  });
});

describe("one header, no duplicated forms", () => {
  it("journey rows each carry one action and the header names the one next step", () => {
    const journey = read("components/event-orders/event-order-journey.tsx");
    assert.equal(journey.match(/event-order-journey-action-/g)?.length, 1);
    assert.match(journey, /Next step: \{current\.title\}/);
    assert.match(journey, /row\.isCurrent \? "default" : "outline"/);
  });

  it("selections panel does not render the full submitted form twice", () => {
    const panel = read("components/client-choices/client-choices-panel.tsx");
    const start = panel.indexOf('data-testid="choices-submission-summary"');
    const block = panel.slice(start, panel.indexOf("</div>", start));
    assert.ok(start > 0);
    assert.doesNotMatch(block, /ChoicesDefinitionView/);
    assert.match(block, /summarizeAnswers\(row\)/);
    assert.match(panel, /Show the full selection request/);
  });
});

describe("template builder + starters", () => {
  it("new lines start Included or Add-on based on the button used", () => {
    const sheet = read("components/event-order-templates/offering-editor-sheet.tsx");
    assert.match(sheet, /defaultIncluded = false/);
    assert.match(sheet, /setIncluded\(defaultIncluded\)/);
    const wizard = read("components/event-order-templates/guided-setup-wizard.tsx");
    assert.match(wizard, /defaultIncluded: true/);
    assert.match(wizard, /defaultIncluded: false/);
  });

  it("starter masters contain only sellable categories; legacy checklist starters stay archived", () => {
    for (const master of EVENT_ORDER_STARTER_MASTERS) {
      for (const section of master.sections) {
        assert.ok(matchSuggestedCategory(section.name), `${master.key}: “${section.name}” is not a sellable category`);
      }
    }
    assert.deepEqual([...LEGACY_EVENT_ORDER_STARTER_KEYS], ["EO-01", "EO-02"]);
    assert.match(read("lib/event-order-templates/provision.ts"), /archiveLegacyChecklistTemplates/);
  });
});
