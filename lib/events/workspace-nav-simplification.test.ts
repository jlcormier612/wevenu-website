/**
 * Client/event workspace top nav: ops tabs plus the event-preparation modules
 * staff move between without returning to Overview. Event Order and Inventory
 * still enter through Setup cards.
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
] as const;

const SETUP_ONLY_TRIGGER_VALUES = ["event-order", "inventory"] as const;

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

  it("keeps Planning, Timeline, Floor Plans, Vendors, and Questionnaires in the top nav", () => {
    const list = tabsListBlock(detail);
    for (const [value, label] of PREPARATION_TRIGGERS) {
      assert.match(list, new RegExp(`TabsTrigger ${value.replace(/"/g, '\\"')}[\\s\\S]*${label}`));
    }
  });

  it("leaves Event Order and Inventory on Setup cards and hash deep links", () => {
    const list = tabsListBlock(detail);
    for (const value of SETUP_ONLY_TRIGGER_VALUES) {
      assert.doesNotMatch(list, new RegExp(`TabsTrigger value="${value}"`));
      assert.match(detail, new RegExp(`TabsContent value="${value}"`));
    }
  });

  it("Setup cards still open the corresponding modules", () => {
    assert.match(setup, /Open Planning[\s\S]*tab="playbook"/);
    assert.match(setup, /Open Timeline[\s\S]*tab="timeline"/);
    assert.match(setup, /Open Floor Plans[\s\S]*tab="floorplan"/);
    assert.match(setup, /Open Vendors[\s\S]*tab="vendors"/);
    assert.match(setup, /Open Event Order[\s\S]*tab="event-order"/);
    assert.match(setup, /Open Inventory[\s\S]*tab="inventory"/);
  });

  it("hash / tab sync still activates the selected module on this event", () => {
    assert.match(detail, /setActiveTab\(tab\)/);
    assert.match(detail, /hashchange/);
    assert.match(detail, /window\.location\.hash = v as string/);
  });
});
