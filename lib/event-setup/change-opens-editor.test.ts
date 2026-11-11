/**
 * Overview "Change for this event" must open the event workspace — not Set up / Skip.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  setupStatusBadgeLabel,
  setupStepTemplateLabel,
} from "@/lib/event-setup/outstanding-follow-ups";
import { SETUP_READINESS_LABEL } from "@/lib/event-setup/readiness-detail";

const panel = readFileSync(resolve("components/events/event-setup-panel.tsx"), "utf8");
const detail = readFileSync(resolve("components/events/event-detail.tsx"), "utf8");
const tasks = readFileSync(resolve("components/playbooks/event-task-list.tsx"), "utf8");

describe("Change for this event opens the event editor", () => {
  it("wires Change to changeForEvent, not setChanging Set up/Skip", () => {
    assert.match(panel, /data-testid=\{`event-setup-change-\$\{step\}`\}/);
    assert.match(panel, /changeForEvent\(step\)/);
    assert.doesNotMatch(panel, /setChanging\(step\)/);
    assert.match(panel, /Don&apos;t include for this event/);
  });

  it("Open Planning lands on the management workspace task list", () => {
    assert.match(panel, /playbook#planning-task-list/);
    assert.match(detail, /planning-task-list/);
    assert.match(tasks, /id="planning-task-list"/);
  });

  it("Change for this event opens the dedicated Planning setup editor", () => {
    assert.match(panel, /setPlanningEditorOpen\(true\)/);
    assert.match(panel, /EventPlanningSetupEditor/);
    assert.doesNotMatch(panel, /playbook#planning-edit/);
  });

  it("Change for Timeline opens a dedicated editor, not navigateStep management", () => {
    assert.match(panel, /setTimelineEditorOpen\(true\)/);
    assert.match(panel, /EventTimelineSetupEditor/);
    assert.match(panel, /SETUP_EDITOR_STEPS/);
  });

  it("Change for Inventory and Event Order open dedicated setup editors", () => {
    assert.match(panel, /setInventoryEditorOpen\(true\)/);
    assert.match(panel, /EventInventorySetupEditor/);
    assert.match(panel, /setEventOrderEditorOpen\(true\)/);
    assert.match(panel, /EventOrderSetupEditor/);
    assert.match(panel, /"inventory", "event_order", "floor_plans"/);
  });

  it("Change for Floor Plans opens a dedicated offers setup editor", () => {
    assert.match(panel, /setFloorPlansEditorOpen\(true\)/);
    assert.match(panel, /EventFloorPlansSetupEditor/);
  });

  it("Change for Vendors opens a dedicated highlights setup editor", () => {
    assert.match(panel, /setVendorsEditorOpen\(true\)/);
    assert.match(panel, /EventVendorsSetupEditor/);
    assert.match(panel, /"floor_plans", "vendors"/);
  });

  it("profile-driven Planning defers release to Overview", () => {
    assert.match(detail, /preferOverviewRelease=\{Boolean\(eventSetup\.usesProfile\)\}/);
    assert.match(tasks, /preferOverviewRelease/);
    assert.match(tasks, /return to Overview and use Release to client portal/);
  });

  it("keeps Planning inclusion Included separate from release copy", () => {
    assert.equal(setupStatusBadgeLabel("set_up", "draft", SETUP_READINESS_LABEL, "planning"), "Included");
    assert.equal(setupStatusBadgeLabel("set_up", "shared", SETUP_READINESS_LABEL, "planning"), "Released");
    assert.equal(
      setupStepTemplateLabel(
        "inventory",
        { planning: null, timeline: null, inventory: "Bar basics", eventOrder: null },
      ),
      "Bar basics",
    );
    assert.match(panel, /state\.profileName/);
  });
});
