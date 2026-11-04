import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

function read(rel: string) {
  return readFileSync(rel, "utf8");
}

describe("Wave G5 — Planning / Timeline template editors", () => {
  it("planning template is full-width hospitality with eucalyptus milestone bars", () => {
    const page = read("app/(app)/library/playbooks/[id]/page.tsx");
    const header = read("components/playbooks/playbook-template-editor-header.tsx");
    const builder = read("components/playbooks/playbook-builder.tsx");
    assert.match(page, /htc-hospitality-page/);
    assert.match(page, /data-htc-phase12="planning-template-edit"/);
    assert.doesNotMatch(page, /max-w-3xl/);
    assert.match(header, /htc-hospitality-heading htc-hospitality-intro-accent/);
    assert.match(builder, /htc-hospitality-section-label/);
  });

  it("timeline template is full-width with primary card separate from starter banner", () => {
    const page = read("app/(app)/library/timeline-templates/[id]/page.tsx");
    const header = read("components/timeline-templates/timeline-template-editor-header.tsx");
    assert.match(page, /htc-hospitality-page/);
    assert.doesNotMatch(page, /max-w-3xl/);
    assert.match(header, /htc-hospitality-heading htc-hospitality-intro-accent/);
    assert.match(header, /StarterOwnershipBanner/);
  });
});

describe("Wave G5 — EO / Inventory / Questionnaire / Floor Plan editors", () => {
  it("EO back link sits above the primary card; attention uses blush", () => {
    const detail = read("components/event-order-templates/event-order-template-detail.tsx");
    const wizard = read("components/event-order-templates/guided-setup-wizard.tsx");
    assert.match(detail, /CollectionBackLink/);
    assert.doesNotMatch(detail, /backHref="\/library\/event-order-templates"/);
    assert.match(wizard, /htc-surface-attention/);
    assert.doesNotMatch(wizard, /border-amber-200 bg-amber-50/);
  });

  it("inventory + questionnaire editors get primary hospitality cards", () => {
    const inventory = read("components/event-inventory/inventory-template-detail.tsx");
    const questionnaire = read("components/questionnaire-templates/questionnaire-authoring-workspace.tsx");
    assert.match(inventory, /htc-hospitality-heading htc-hospitality-intro-accent/);
    assert.match(inventory, /CollectionBackLink/);
    assert.match(questionnaire, /htc-hospitality-heading htc-hospitality-intro-accent/);
  });

  it("floor plan starter banner sits beneath primary card", () => {
    const page = read("app/(app)/library/floor-plan-templates/[id]/page.tsx");
    const header = read("components/floor-plan-templates/floor-plan-template-editor-header.tsx");
    assert.doesNotMatch(page, /htc-hospitality-heading[\s\S]*FloorPlanTemplateEditorHeader/);
    assert.match(header, /htc-hospitality-heading htc-hospitality-intro-accent/);
    assert.match(header, /StarterOwnershipBanner/);
  });
});

describe("Wave G5 — instructional working-card guidance + chips", () => {
  it("adds calm-blue working-card-guidance utility", () => {
    const css = read("app/globals.css");
    assert.match(
      css,
      /\.htc-working-card\.htc-working-card-guidance > \[data-slot="card-header"\][\s\S]*?var\(--htc-calm-blue\)/,
    );
  });

  it("message/packages/inventory instructional headers use guidance", () => {
    const message = read("app/(app)/communication/templates/[id]/edit/page.tsx");
    const packages = read("app/(app)/packages/[id]/page.tsx");
    const inventory = read("app/(app)/library/inventory/[id]/edit/page.tsx");
    assert.match(message, /htc-working-card-guidance/);
    assert.match(packages, /htc-working-card-guidance/);
    assert.match(inventory, /htc-working-card-guidance/);
  });

  it("removes duplicate form back links on packages + inventory", () => {
    const pkg = read("components/packages/package-form.tsx");
    const inv = read("components/inventory/inventory-item-form.tsx");
    assert.doesNotMatch(pkg, /CollectionBackLink/);
    assert.doesNotMatch(inv, /CollectionBackLink/);
  });

  it("Unpriced uses blush attention; Category uses eucalyptus active", () => {
    const offerings = read("components/offerings/offerings-library-section.tsx");
    assert.match(offerings, /offering-unpriced[\s\S]*?htc-badge-attention|htc-badge-attention[\s\S]*?offering-unpriced/);
    assert.match(offerings, /htc-badge-active[\s\S]*?Category|>Category<\/Badge>/);
  });

  it("Tour Scheduled + Partially Paid + open tasks use eucalyptus active", () => {
    const leadBadge = read("components/leads/lead-status-badge.tsx");
    const invoice = read("components/invoices/invoice-status-badge.tsx");
    const tasks = read("components/playbooks/event-task-list.tsx");
    assert.match(leadBadge, /tour_scheduled[\s\S]*?htc-badge-active|htc-badge-active[\s\S]*?tour_scheduled/);
    assert.match(invoice, /partially_paid/);
    assert.match(invoice, /htc-badge-active/);
    assert.match(tasks, /htc-badge-active/);
  });

  it("activity icons use eucalyptus surface wash", () => {
    const lead = read("components/leads/activity-timeline.tsx");
    const conversation = read("components/conversations/activity-timeline.tsx");
    assert.match(lead, /--htc-eucalyptus-surface/);
    assert.match(conversation, /--htc-eucalyptus-surface/);
    assert.doesNotMatch(lead, /bg-primary\/15/);
    assert.doesNotMatch(conversation, /bg-primary\/15/);
  });
});

describe("Wave G5 — relationship workspace tabs", () => {
  it("planning + lead overview use RelationshipTabShell; vendors use guidance cards", () => {
    const event = read("components/events/event-detail.tsx");
    const lead = read("components/leads/lead-detail.tsx");
    assert.match(event, /testId="event-planning-tab"/);
    assert.match(event, /htc-working-card-guidance[\s\S]*Vendor Network|Vendor Network[\s\S]*htc-working-card-guidance/);
    assert.match(lead, /testId="lead-overview-tab"/);
  });

  it("timeline summary bars use eucalyptus section labels", () => {
    const summary = read("components/events/timeline/timeline-summary-bar.tsx");
    const view = read("components/events/timeline/timeline-view.tsx");
    assert.match(summary, /htc-hospitality-section-label/);
    assert.match(view, /timeline-day-of-booking-window[\s\S]*htc-hospitality-section-label|htc-hospitality-section-label[\s\S]*timeline-day-of-booking-window/);
  });
});
