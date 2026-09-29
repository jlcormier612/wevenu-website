import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  isStandardPlanningMasterKey,
  visiblePlanningStarterKinds,
} from "@/lib/playbooks/planning-starter-visibility";

describe("Library Planning starter duplication UX", () => {
  it("1. no PB-CLIENT-01 → Client Planning starter card is shown", () => {
    const { showClient, showVenue } = visiblePlanningStarterKinds([
      { sourceMasterKey: null },
    ]);
    assert.equal(showClient, true);
    assert.equal(showVenue, true);
  });

  it("2. PB-CLIENT-01 exists → Client Planning starter card is hidden", () => {
    const { showClient, showVenue } = visiblePlanningStarterKinds([
      { sourceMasterKey: "PB-CLIENT-01" },
    ]);
    assert.equal(showClient, false);
    assert.equal(showVenue, true);
  });

  it("3. no PB-VENUE-01 → Venue Planning starter card is shown", () => {
    const { showClient, showVenue } = visiblePlanningStarterKinds([
      { sourceMasterKey: "PB-CLIENT-01" },
    ]);
    assert.equal(showVenue, true);
    assert.equal(showClient, false);
  });

  it("4. PB-VENUE-01 exists → Venue Planning starter card is hidden", () => {
    const { showClient, showVenue } = visiblePlanningStarterKinds([
      { sourceMasterKey: "PB-CLIENT-01" },
      { sourceMasterKey: "PB-VENUE-01" },
    ]);
    assert.equal(showClient, false);
    assert.equal(showVenue, false);
  });

  it("5. existing Library template remains the sole prominent representation (wiring)", () => {
    const starters = readFileSync(
      resolve("components/playbooks/planning-starter-examples.tsx"),
      "utf8",
    );
    assert.match(starters, /visiblePlanningStarterKinds/);
    assert.match(starters, /if \(!showClient && !showVenue\) return null/);
    assert.match(starters, /\{showClient && \(/);
    assert.match(starters, /\{showVenue && \(/);
    assert.doesNotMatch(starters, /Add again/);
    assert.doesNotMatch(starters, /Already in your library/);

    const page = readFileSync(resolve("app/(app)/library/playbooks/page.tsx"), "utf8");
    assert.match(page, /<PlanningStarterExamples templates=\{templates\}/);
    assert.match(page, /<PlaybooksSection[\s\S]*initialTemplates=\{templates\}/);

    const section = readFileSync(resolve("components/settings/playbooks-section.tsx"), "utf8");
    assert.match(section, /LIBRARY_LABELS\.useTemplate/);
    assert.match(section, /LIBRARY_LABELS\.preview/);
    assert.match(section, /LIBRARY_LABELS\.edit/);
    assert.match(section, /onUse=\{\(\) => setUsing\(t\)\}/);
  });

  it("6. Add another copy remains available as a secondary action on the master Library row", () => {
    const section = readFileSync(resolve("components/settings/playbooks-section.tsx"), "utf8");
    assert.match(section, /LIBRARY_LABELS\.addAnotherCopy/);
    assert.match(section, /isStandardPlanningMasterKey\(t\.sourceMasterKey\)/);
    assert.match(section, /handleAddAnotherCopy/);
    assert.match(section, /createStandardClientPlanningTemplateAction/);
    assert.match(section, /createStandardVenueWorkflowTemplateAction/);

    const labels = readFileSync(resolve("components/library/labels.ts"), "utf8");
    assert.match(labels, /addAnotherCopy:\s*"Add another copy"/);

    const service = readFileSync(resolve("lib/playbooks/service.ts"), "utf8");
    const clientCreate = service.slice(
      service.indexOf("export async function createStandardClientPlanningTemplate"),
      service.indexOf("export async function createStandardVenueWorkflowTemplate"),
    );
    assert.match(clientCreate, /source_master_key", "PB-CLIENT-01"/);
    assert.match(clientCreate, /Standard Wedding — Client Planning \(Copy\)/);
    assert.match(clientCreate, /null,/);

    const venueCreate = service.slice(
      service.indexOf("export async function createStandardVenueWorkflowTemplate"),
      service.indexOf("// ---- Bring Your Existing Checklist"),
    );
    assert.match(venueCreate, /source_master_key", "PB-VENUE-01"/);
    assert.match(venueCreate, /Standard Wedding — Venue Planning \(Copy\)/);
  });

  it("7. applying an existing template to an event/client remains unchanged", () => {
    const section = readFileSync(resolve("components/settings/playbooks-section.tsx"), "utf8");
    assert.match(section, /UsePlaybookFlow/);
    assert.match(section, /PlaybookApplyPreviewSheet/);
    // Primary Use Template still opens the event-pick → apply sheet, not create-starter.
    const useFlow = section.slice(
      section.indexOf("function UsePlaybookFlow"),
      section.indexOf("function TemplateCard"),
    );
    assert.match(useFlow, /PlaybookApplyPreviewSheet/);
    assert.match(useFlow, /templateId=\{template\.id\}/);
    assert.match(useFlow, /eventId=\{selected\.id\}/);
    assert.doesNotMatch(useFlow, /createStandardClientPlanningTemplateAction/);
    assert.doesNotMatch(useFlow, /createStandardVenueWorkflowTemplateAction/);

    const sheet = readFileSync(
      resolve("components/playbooks/playbook-apply-preview-sheet.tsx"),
      "utf8",
    );
    assert.match(sheet, /applyPlaybookAction/);
    assert.match(sheet, /applyPlaybookToClientAction/);
  });

  it("master-key helper only recognizes official starters", () => {
    assert.equal(isStandardPlanningMasterKey("PB-CLIENT-01"), true);
    assert.equal(isStandardPlanningMasterKey("PB-VENUE-01"), true);
    assert.equal(isStandardPlanningMasterKey(null), false);
    assert.equal(isStandardPlanningMasterKey("PB-OTHER"), false);
  });
});
