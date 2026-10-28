/**
 * Timeline (and shared Library) starter ownership / customize UX contracts.
 * Kept separate from chronological-order.test.ts so failures diagnose independently.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Timeline template ownership UX", () => {
  it("duplicate does not copy source_master_key (venue-owned independent copy)", () => {
    const repo = readFileSync(resolve("lib/timeline-templates/repository.ts"), "utf8");
    const dup = repo.slice(repo.indexOf("duplicateTemplateInto"));
    assert.match(dup, /insertTemplate\(client, venueId, newName/);
    // insertTemplate only sets source_master_key when opts is passed — duplicate omits it.
    assert.doesNotMatch(dup.slice(0, 600), /sourceMasterKey/);
  });

  it("supports template-level details update without touching items", () => {
    const repo = readFileSync(resolve("lib/timeline-templates/repository.ts"), "utf8");
    assert.match(repo, /export async function updateTemplateDetails/);
    assert.match(repo, /event_type: input\.eventType/);
    assert.match(repo, /space_id: input\.spaceId/);
    const service = readFileSync(resolve("lib/timeline-templates/service.ts"), "utf8");
    assert.match(service, /updateTemplateDetails_/);
  });

  it("editor page exposes starter banner, customize, and edit details", () => {
    const header = readFileSync(
      resolve("components/timeline-templates/timeline-template-editor-header.tsx"),
      "utf8",
    );
    assert.match(header, /StarterOwnershipBanner/);
    assert.match(header, /LIBRARY_LABELS\.editDetails/);
    assert.match(header, /LIBRARY_LABELS\.yourTemplate/);
    assert.match(header, /duplicateTemplateAction/);

    const page = readFileSync(
      resolve("app/(app)/library/timeline-templates/[id]/page.tsx"),
      "utf8",
    );
    assert.match(page, /TimelineTemplateEditorHeader/);
    assert.match(page, /TimelineTemplateEditor/);
  });

  it("library card promotes Customize for starters with Edit (not Edit activities)", () => {
    const section = readFileSync(
      resolve("components/timeline-templates/timeline-templates-section.tsx"),
      "utf8",
    );
    assert.match(section, /LIBRARY_LABELS\.customize/);
    assert.match(section, /LIBRARY_LABELS\.edit/);
    assert.doesNotMatch(section, /LIBRARY_LABELS\.editActivities/);
    assert.match(section, /isStarter/);
  });
});

describe("Shared Library starter customize coverage", () => {
  const files = [
    "components/floor-plan-templates/floor-plan-templates-section.tsx",
    "components/event-order-templates/event-order-template-list.tsx",
    "components/event-inventory/inventory-template-list.tsx",
    "components/questionnaire-templates/questionnaire-template-list.tsx",
    "components/settings/playbooks-section.tsx",
  ];

  for (const file of files) {
    it(`${file} exposes Customize for starters`, () => {
      const src = readFileSync(resolve(file), "utf8");
      assert.match(src, /LIBRARY_LABELS\.customize/);
      assert.match(src, /isStarter/);
    });
  }

  it("shared starter banner explains copy semantics", () => {
    const banner = readFileSync(resolve("components/library/starter-ownership-banner.tsx"), "utf8");
    assert.match(banner, /Hello to Cheers starter/);
    assert.match(banner, /separate venue-owned template/);
    assert.match(banner, /starter-customize/);
    assert.match(banner, /original starter stays available/);
  });
});

describe("Edit Details coverage across template types", () => {
  const cases: { file: string; marker: string; notes?: string }[] = [
    {
      file: "components/timeline-templates/timeline-template-details-sheet.tsx",
      marker: "LIBRARY_LABELS.editDetails",
    },
    {
      file: "components/floor-plan-templates/floor-plan-template-details-sheet.tsx",
      marker: "LIBRARY_LABELS.editDetails",
    },
    {
      file: "components/event-order-templates/event-order-template-detail.tsx",
      marker: "LIBRARY_LABELS.editDetails",
    },
    {
      file: "components/event-inventory/inventory-template-details-sheet.tsx",
      marker: "LIBRARY_LABELS.editDetails",
    },
    {
      file: "components/questionnaire-templates/questionnaire-template-details-sheet.tsx",
      marker: "LIBRARY_LABELS.editDetails",
    },
    {
      file: "components/playbooks/playbook-template-details-sheet.tsx",
      marker: "LIBRARY_LABELS.editDetails",
    },
  ];

  for (const c of cases) {
    it(`${c.file} exposes Edit details`, () => {
      const src = readFileSync(resolve(c.file), "utf8");
      assert.match(src, new RegExp(c.marker.replace(".", "\\.")));
    });
  }

  it("EO / Inventory / Questionnaire document no space/event-type scope where unsupported", () => {
    const eo = readFileSync(
      resolve("components/event-order-templates/event-order-template-detail.tsx"),
      "utf8",
    );
    assert.match(eo, /not scoped to an\s+event type or venue space/);

    const inv = readFileSync(
      resolve("components/event-inventory/inventory-template-details-sheet.tsx"),
      "utf8",
    );
    assert.match(inv, /not scoped to an\s+event type or venue space/);

    const q = readFileSync(
      resolve("components/questionnaire-templates/questionnaire-template-details-sheet.tsx"),
      "utf8",
    );
    assert.match(q, /not scoped to an event type\s+or venue space/);
  });

  it("Floor Plans and Timeline support event type + space in details updates", () => {
    const fp = readFileSync(resolve("lib/floor-plan-templates/repository.ts"), "utf8");
    assert.match(fp, /export async function updateTemplateDetails/);
    assert.match(fp, /event_type: input\.eventType/);
    assert.match(fp, /space_id: input\.spaceId/);

    const tl = readFileSync(resolve("lib/timeline-templates/repository.ts"), "utf8");
    assert.match(tl, /export async function updateTemplateDetails/);
    assert.match(tl, /space_id: input\.spaceId/);
  });

  it("Inventory and Questionnaire details update name/description only", () => {
    const inv = readFileSync(resolve("lib/event-inventory/repository.ts"), "utf8");
    assert.match(inv, /export async function updateTemplateDetails/);
    assert.match(inv, /description: input\.description/);

    const q = readFileSync(resolve("lib/questionnaire-templates/service.ts"), "utf8");
    assert.match(q, /export async function updateTemplateDetails/);
    assert.match(q, /description: input\.description/);
  });
});

describe("Playbooks Duplicate vs Add another copy semantics", () => {
  it("keeps Add another copy as master re-provision, distinct from Duplicate", () => {
    const section = readFileSync(resolve("components/settings/playbooks-section.tsx"), "utf8");
    assert.match(section, /LIBRARY_LABELS\.addAnotherCopy/);
    assert.match(section, /LIBRARY_LABELS\.duplicate/);
    assert.match(section, /LIBRARY_LABELS\.customize/);
    assert.match(section, /createStandardClientPlanningTemplateAction/);
    assert.match(section, /createStandardVenueWorkflowTemplateAction/);
    assert.match(section, /Distinct from Duplicate/);

    const labels = readFileSync(resolve("components/library/labels.ts"), "utf8");
    assert.match(labels, /addAnotherCopy:\s*"Add another copy"/);
    assert.match(labels, /duplicate:\s*"Duplicate"/);
  });

  it("playbook editor exposes Edit details and starter Customize path", () => {
    const header = readFileSync(
      resolve("components/playbooks/playbook-template-editor-header.tsx"),
      "utf8",
    );
    assert.match(header, /LIBRARY_LABELS\.editDetails/);
    assert.match(header, /StarterOwnershipBanner/);
    assert.match(header, /duplicateTemplateAction/);
  });
});
