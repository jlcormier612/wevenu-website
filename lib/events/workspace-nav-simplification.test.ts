/**
 * Client/event workspace top nav: ops tabs plus the event-preparation modules
 * staff move between without returning to Overview.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const detail = readFileSync(resolve("components/events/event-detail.tsx"), "utf8");
const setup = readFileSync(resolve("components/events/event-setup-panel.tsx"), "utf8");

const RETAINED_TRIGGERS = [
  'value="overview"',
  'value="documents"',
  'value="invoice"',
  'value="messages"',
  'value="activity"',
  'value="notes"',
] as const;

const PREPARATION_TRIGGERS = [
  ['value="playbook"', "Planning"],
  ['value="timeline"', "Timeline"],
  ['value="floorplan"', "Floor Plans"],
  ['value="vendors"', "Vendors"],
  ['value="questionnaires"', "Questionnaires"],
  ['value="inventory"', "Inventory"],
  ['value="event-order"', "Event Order"],
] as const;

function tabsListBlock(source: string): string {
  const start = source.indexOf("<TabsList");
  const end = source.indexOf("</TabsList>", start);
  assert.ok(start >= 0 && end > start, "TabsList present");
  return source.slice(start, end);
}

describe("workspace top nav simplification", () => {
  it("keeps the retained top-level TabsTriggers and does not offer Team", () => {
    const list = tabsListBlock(detail);
    for (const value of RETAINED_TRIGGERS) {
      assert.match(list, new RegExp(`TabsTrigger ${value}`));
    }
    assert.match(list, />Conversation</);
    assert.match(list, /INTERNAL_NOTES_LABEL/);
    assert.doesNotMatch(list, /TabsTrigger value="team"/);
  });

  it("keeps Planning through Event Order in the top nav as ongoing workspaces", () => {
    const list = tabsListBlock(detail);
    for (const [value, label] of PREPARATION_TRIGGERS) {
      assert.match(list, new RegExp(`TabsTrigger ${value.replace(/"/g, '\\"')}[\\s\\S]*${label}`));
    }
  });

  it("Setup cards still open the corresponding modules", () => {
    assert.match(setup, /"Open Planning"/);
    assert.match(setup, /playbook#planning-task-list/);
    assert.match(setup, /"Open Timeline"/);
    assert.match(setup, /step === "floor_plans" \? "floorplan"/);
    assert.match(setup, /"Open Vendors"/);
    assert.match(setup, /"Open Event Order"/);
    assert.match(setup, /"Open Inventory"/);
    assert.match(setup, /step === "inventory" \? "inventory"/);
    assert.match(setup, /step === "event_order" \? "event-order"/);
    assert.match(setup, /changeForEvent\(step\)/);
    assert.match(setup, /EventPlanningSetupEditor/);
  });

  it("hash / tab sync still activates the selected module on this event", () => {
    assert.match(detail, /setActiveTab/);
    assert.match(detail, /hashchange/);
    assert.match(detail, /window\.location\.hash = v as string/);
    assert.match(detail, /planning-task-list/);
  });
});
