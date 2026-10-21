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
  it("wires Change to navigateStep edit focus, not setChanging Set up/Skip", () => {
    assert.match(panel, /data-testid=\{`event-setup-change-\$\{step\}`\}/);
    assert.match(panel, /navigateStep\(step, "edit"\)/);
    assert.doesNotMatch(panel, /setChanging\(step\)/);
    assert.match(panel, /Don&apos;t include for this event/);
  });

  it("Open Planning lands on the event-specific checklist editor", () => {
    assert.match(panel, /playbook#planning-task-list/);
    assert.match(panel, /playbook#planning-edit/);
    assert.match(detail, /planning-task-list/);
    assert.match(detail, /planning-edit/);
    assert.match(tasks, /id="planning-task-list"/);
    assert.match(tasks, /id="planning-edit"/);
  });

  it("profile-driven Planning defers release to Overview", () => {
    assert.match(detail, /preferOverviewRelease=\{Boolean\(eventSetup\.usesProfile\)\}/);
    assert.match(tasks, /preferOverviewRelease/);
    assert.match(tasks, /return to Overview and use Release to client portal/);
  });

  it("keeps badge lifecycle separate from template naming", () => {
    assert.equal(setupStatusBadgeLabel("set_up", "draft", SETUP_READINESS_LABEL), "Draft");
    assert.equal(setupStatusBadgeLabel("set_up", "shared", SETUP_READINESS_LABEL), "Released");
    assert.equal(
      setupStepTemplateLabel(
        "inventory",
        { planning: null, timeline: null, inventory: "Bar basics", eventOrder: null },
      ),
      "Bar basics",
    );
    assert.doesNotMatch(panel, /\$\{state\.profileName\}/);
    assert.match(panel, /setupStepTemplateLabel/);
  });
});
