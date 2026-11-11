import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

function read(rel: string) {
  return readFileSync(rel, "utf8");
}

describe("Wave G3 — Activity icons eucalyptus", () => {
  it("conversation + lead activity timelines drop muted/mixed icon fills", () => {
    const conversation = read("components/conversations/activity-timeline.tsx");
    const lead = read("components/leads/activity-timeline.tsx");
    assert.match(conversation, /ACTIVITY_ICON_EUCALYPTUS/);
    assert.match(lead, /ACTIVITY_ICON_EUCALYPTUS/);
    assert.doesNotMatch(conversation, /bg-muted text-muted-foreground/);
    assert.doesNotMatch(lead, /bg-muted text-muted-foreground/);
    assert.match(conversation, /htc-surface-guidance[\s\S]*activity-timeline-empty|activity-timeline-empty[\s\S]*htc-surface-guidance/);
  });
});

describe("Wave G3 — Documents recipe tab shells", () => {
  it("Lead notes/tasks/activity use RelationshipTabShell", () => {
    const lead = read("components/leads/lead-detail.tsx");
    assert.match(lead, /RelationshipTabShell/);
    assert.match(lead, /testId="lead-notes-tab"/);
    assert.match(lead, /testId="lead-tasks-tab"/);
    assert.match(lead, /testId="lead-activity-tab"/);
  });

  it("Booking payments/activity/questionnaires/timeline/floor/vendors use RelationshipTabShell", () => {
    const event = read("components/events/event-detail.tsx");
    assert.match(event, /RelationshipTabShell/);
    assert.match(event, /testId="event-payments-tab"/);
    assert.match(event, /testId="event-activity-tab"/);
    assert.match(event, /testId="event-questionnaires-tab"/);
    assert.match(event, /testId="event-timeline-tab"/);
    assert.match(event, /testId="event-floorplan-tab"/);
    assert.match(event, /testId="event-vendors-tab"/);
    assert.match(event, /htc-working-row[\s\S]*invoices\.map|invoices\.map[\s\S]*htc-working-row/);
  });

  it("shell matches Documents heading recipe", () => {
    const shell = read("components/relationship/relationship-tab-shell.tsx");
    assert.match(shell, /htc-hospitality-heading htc-hospitality-intro-accent/);
    assert.match(shell, /htc-surface-guidance/);
    assert.match(shell, /data-htc-phase12="relationship-tab"/);
  });
});

describe("Wave G3 — Payments / Questionnaires chrome", () => {
  it("quiet invoice statuses use eucalyptus attention chips, not muted gray", () => {
    const badge = read("components/invoices/invoice-status-badge.tsx");
    assert.match(badge, /htc-badge-active/);
    assert.doesNotMatch(badge, /draft:\s*"muted"/);
  });

  it("questionnaire library apply uses calm guidance, not muted wash", () => {
    const panel = read("components/events/questionnaire-family-panel.tsx");
    assert.match(panel, /questionnaire-library-apply[\s\S]*htc-surface-guidance-compact|htc-surface-guidance-compact[\s\S]*questionnaire-library-apply/);
    assert.doesNotMatch(panel, /questionnaire-library-apply[\s\S]*bg-muted\/30|bg-muted\/30[\s\S]*questionnaire-library-apply/);
  });
});
