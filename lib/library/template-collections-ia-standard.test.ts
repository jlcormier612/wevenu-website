import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(rel: string) {
  return readFileSync(resolve(rel), "utf8");
}

describe("template collection IA standardization", () => {
  it("Contract keeps + New Template in PageHeader (reference)", () => {
    const page = read("app/(app)/library/contracts/page.tsx");
    assert.match(page, /PageHeader[\s\S]*\+ New Template/);
    assert.match(page, /CollectionBackLink[\s\S]*label="Templates"/);
    assert.doesNotMatch(page, /Import/);
  });

  it("Planning puts + New Template and Import in PageHeader; no embedded capabilities", () => {
    const page = read("app/(app)/library/playbooks/page.tsx");
    assert.match(page, /PlaybookStarterPicker/);
    assert.match(page, /variant="import"/);
    assert.match(page, /headerCreate=\{false\}/);
    assert.doesNotMatch(page, /PlanningCapabilitiesSection|planning-capabilities-section/);
    const picker = read("components/playbooks/playbook-starter-picker.tsx");
    assert.match(picker, /\+ New Template/);
    assert.match(picker, /"Import"/);
    assert.doesNotMatch(picker, /Import a checklist|New template/);
  });

  it("Timeline / Floor Plan use + New Template (not type-specific labels)", () => {
    const timelinePicker = read("components/timeline-templates/timeline-template-starter-picker.tsx");
    assert.match(timelinePicker, /\+ New Template/);
    assert.doesNotMatch(timelinePicker, /New Timeline Template/);
    const floorPicker = read("components/floor-plan-templates/floor-plan-template-starter-picker.tsx");
    assert.match(floorPicker, /\+ New Template/);
    assert.doesNotMatch(floorPicker, /New Floor Plan Template/);
    const timelinePage = read("app/(app)/library/timeline-templates/page.tsx");
    assert.match(timelinePage, /headerCreate=\{false\}/);
    assert.match(timelinePage, /CollectionBackLink[\s\S]*label="Templates"/);
    const floorPage = read("app/(app)/library/floor-plan-templates/page.tsx");
    assert.match(floorPage, /headerCreate=\{false\}/);
  });

  it("EO / Inventory expose + New Template in PageHeader and keep Send on rows", () => {
    const eoPage = read("app/(app)/library/event-order-templates/page.tsx");
    assert.match(eoPage, /NewEventOrderTemplateButton/);
    assert.match(eoPage, /headerCreate=\{false\}/);
    const invPage = read("app/(app)/library/inventory-templates/page.tsx");
    assert.match(invPage, /NewInventoryTemplateButton/);
    assert.match(invPage, /headerCreate=\{false\}/);
    const eoList = read("components/event-order-templates/event-order-template-list.tsx");
    assert.match(eoList, /sendToClient|onSend/);
    const invList = read("components/event-inventory/inventory-template-list.tsx");
    assert.match(invList, /sendToClient|onSend/);
  });

  it("Message Templates: + New Template then Import; no Import Messages label", () => {
    const page = read("app/(app)/communication/templates/page.tsx");
    assert.match(page, /MessageTemplateStarterPicker existingTemplates=\{active\} \/>/);
    assert.match(page, /variant="import"/);
    const picker = read("components/communication/message-template-starter-picker.tsx");
    assert.match(picker, /\+ New Template/);
    assert.match(picker, /"Import"/);
    assert.doesNotMatch(picker, /Import Messages/);
  });

  it("collection row Use label is Use (not type-specific Use Timeline/Floor Plan)", () => {
    const labels = read("components/library/labels.ts");
    assert.match(labels, /useTemplate: "Use"/);
    assert.match(labels, /useTimeline: "Use"/);
    assert.match(labels, /useFloorPlan: "Use"/);
  });

  it("Templates landing does not expose Choices Templates", () => {
    const hub = read("app/(app)/library/page.tsx");
    assert.doesNotMatch(hub, /Choices Templates|choices-templates/);
  });
});
