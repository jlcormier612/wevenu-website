/**
 * Event-specific Planning setup editor seams — distinct from management workspace.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { SETUP_READINESS_LABEL } from "@/lib/event-setup/readiness-detail";
import { setupStatusBadgeLabel } from "@/lib/event-setup/outstanding-follow-ups";

const panel = readFileSync(resolve("components/events/event-setup-panel.tsx"), "utf8");
const editor = readFileSync(resolve("components/events/event-planning-setup-editor.tsx"), "utf8");
const tasks = readFileSync(resolve("components/playbooks/event-task-list.tsx"), "utf8");
const actions = readFileSync(resolve("app/(app)/playbooks/actions.ts"), "utf8");
const service = readFileSync(resolve("lib/playbooks/service.ts"), "utf8");
const repo = readFileSync(resolve("lib/playbooks/repository.ts"), "utf8");

describe("Planning Included badge vs release state", () => {
  it("shows Included for draft Planning, Released after shared, never Draft as inclusion", () => {
    assert.equal(
      setupStatusBadgeLabel("set_up", "draft", SETUP_READINESS_LABEL, "planning"),
      "Included",
    );
    assert.equal(
      setupStatusBadgeLabel("set_up", "shared", SETUP_READINESS_LABEL, "planning"),
      "Released",
    );
    assert.equal(
      setupStatusBadgeLabel("skipped", "not_included", SETUP_READINESS_LABEL, "planning"),
      "Not included",
    );
  });
});

describe("Open Planning vs Change for this event destinations", () => {
  it("Open Planning navigates to the management task list", () => {
    assert.match(panel, /playbook#planning-task-list/);
    assert.match(panel, /Open Planning/);
  });

  it("Change for this event opens the dedicated setup editor sheet, not playbook#planning-edit", () => {
    assert.match(panel, /setPlanningEditorOpen\(true\)/);
    assert.match(panel, /EventPlanningSetupEditor/);
    assert.doesNotMatch(panel, /playbook#planning-edit/);
    assert.match(editor, /data-testid="event-planning-setup-editor"/);
  });

  it("the two actions do not share the same destination", () => {
    assert.match(panel, /function changeForEvent/);
    assert.match(panel, /setPlanningEditorOpen\(true\)/);
    assert.match(panel, /onNavigateTab\("playbook#planning-task-list"\)/);
    assert.doesNotMatch(panel, /changeForEvent[\s\S]{0,200}playbook#planning-task-list/);
  });

  it("Change for Timeline opens the timeline setup editor, not the management tab", () => {
    assert.match(panel, /setTimelineEditorOpen\(true\)/);
    assert.match(panel, /EventTimelineSetupEditor/);
    assert.match(panel, /SETUP_EDITOR_STEPS/);
    const changeFn = panel.slice(panel.indexOf("function changeForEvent"));
    assert.doesNotMatch(changeFn.slice(0, 500), /navigateStep\(step\)/);
  });

  it("Change for Inventory and Event Order open setup editors, not management tabs", () => {
    assert.match(panel, /setInventoryEditorOpen\(true\)/);
    assert.match(panel, /setEventOrderEditorOpen\(true\)/);
    const changeFn = panel.slice(panel.indexOf("function changeForEvent"));
    assert.doesNotMatch(changeFn.slice(0, 1200), /navigateStep\(step\)/);
  });
});

describe("setup editor editing paths and boundaries", () => {
  it("offers only template switch and customize paths", () => {
    assert.match(editor, /planning-setup-mode-template/);
    assert.match(editor, /planning-setup-mode-customize/);
    assert.match(editor, /Choose a different template/);
    assert.match(editor, /Customize this event/);
  });

  it("template selection can be canceled without applying", () => {
    assert.match(editor, /planning-setup-cancel-template/);
    assert.match(editor, /cancelTemplateSelection/);
    const venueEditor = readFileSync(resolve("components/events/event-venue-planning-setup-editor.tsx"), "utf8");
    assert.match(venueEditor, /venue-planning-setup-cancel-template/);
    assert.match(venueEditor, /cancelTemplateSelection/);
  });

  it("offers client and venue checklist audiences", () => {
    assert.match(editor, /planning-setup-audience-client/);
    assert.match(editor, /planning-setup-audience-venue/);
    assert.match(editor, /EventVenuePlanningSetupEditor/);
  });

  it("recovers missing venue checklist from inherited preferred template id", () => {
    assert.match(panel, /preferredVenueTemplateId=\{inheritedRefs\.venuePlanningPlaybookTemplateId/);
    const venueEditor = readFileSync(resolve("components/events/event-venue-planning-setup-editor.tsx"), "utf8");
    assert.match(venueEditor, /applyPlaybookAction/);
    assert.match(venueEditor, /preferredTemplateId/);
    assert.match(venueEditor, /Configured venue checklist/);
  });

  it("does not expose management fulfillment actions", () => {
    assert.doesNotMatch(editor, /Create Request/);
    assert.doesNotMatch(editor, /Waive/);
    assert.doesNotMatch(editor, /completeTaskAction/);
    assert.doesNotMatch(editor, /Release to/);
    assert.doesNotMatch(editor, /Invite client/);
  });

  it("persists via event-specific replace/add/remove/update without Library mutation", () => {
    assert.match(actions, /replaceClientPlaybookAction/);
    assert.match(actions, /addCustomClientEventTaskAction/);
    assert.match(actions, /removeClientEventTaskAction/);
    assert.match(actions, /updateClientEventTaskFieldsAction/);
    assert.match(actions, /replaceVenuePlaybookAction/);
    assert.match(actions, /addCustomVenueEventTaskAction/);
    assert.match(actions, /removeVenueEventTaskAction/);
    assert.match(actions, /updateVenueEventTaskFieldsAction/);
    assert.match(service, /replaceClientPlaybookOnEvent/);
    assert.match(service, /replaceVenuePlaybookOnEvent/);
    assert.match(repo, /template_task_id: null/);
    assert.match(repo, /requireDraftClientApplication/);
    assert.match(repo, /replaceVenuePlaybookOnEvent/);
    // Custom add writes event_tasks only — no playbook_tasks insert in the helper.
    const addFn = repo.slice(repo.indexOf("export async function addCustomClientEventTask"));
    assert.match(addFn, /from\("event_tasks"\)/);
    assert.doesNotMatch(addFn.slice(0, 1200), /from\("playbook_tasks"\)/);
    const venueAdd = repo.slice(repo.indexOf("export async function addCustomVenueEventTask"));
    assert.match(venueAdd, /owner_type: "coordinator"/);
    assert.doesNotMatch(venueAdd.slice(0, 1200), /from\("playbook_tasks"\)/);
  });

  it("management workspace still has Create Request / Waive", () => {
    assert.match(tasks, /Create Request|createRequestForTaskAction/);
    assert.match(tasks, /Waive|waived/);
  });
});

describe("Timeline setup editor seams", () => {
  const timelineEditor = readFileSync(resolve("components/events/event-timeline-setup-editor.tsx"), "utf8");
  const apply = readFileSync(resolve("lib/timeline-templates/apply.ts"), "utf8");

  it("offers template switch and customize without share or Library mutation", () => {
    assert.match(timelineEditor, /timeline-setup-mode-template/);
    assert.match(timelineEditor, /timeline-setup-mode-customize/);
    assert.match(timelineEditor, /replaceEventTimelineFromTemplateAction/);
    assert.doesNotMatch(timelineEditor, /shareTimelineWithCouple/);
    assert.match(apply, /replaceEventTimelineFromTemplate/);
    assert.match(apply, /replace_venue_timeline_from_template_items/);
    assert.match(timelineEditor, /Timeline tab instead/);
  });

  it("template selection can be canceled and apply keeps the editor open", () => {
    assert.match(timelineEditor, /timeline-setup-cancel-template/);
    assert.match(timelineEditor, /cancelTemplateSelection/);
    const applyFn = timelineEditor.slice(timelineEditor.indexOf("function applyTemplate"));
    assert.doesNotMatch(applyFn.slice(0, 800), /onOpenChange\(false\)/);
  });
});
