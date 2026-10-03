/**
 * Client/event workspace top nav: keep ops tabs; setup modules enter via Setup cards.
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
  'value="team"',
] as const;

const REMOVED_TRIGGER_VALUES = [
  "playbook",
  "timeline",
  "floorplan",
  "vendors",
  "event-order",
  "inventory",
] as const;

function tabsListBlock(source: string): string {
  const start = source.indexOf("<TabsList");
  const end = source.indexOf("</TabsList>", start);
  assert.ok(start >= 0 && end > start, "TabsList present");
  return source.slice(start, end);
}

describe("workspace top nav simplification", () => {
  it("keeps the seven retained top-level TabsTriggers", () => {
    const list = tabsListBlock(detail);
    for (const value of RETAINED_TRIGGERS) {
      assert.match(list, new RegExp(`TabsTrigger ${value}`));
    }
    assert.match(list, />Conversation</);
    assert.match(list, /INTERNAL_NOTES_LABEL/);
  });

  it("removes the six setup-module TabsTriggers from top navigation only", () => {
    const list = tabsListBlock(detail);
    for (const value of REMOVED_TRIGGER_VALUES) {
      assert.doesNotMatch(list, new RegExp(`TabsTrigger value="${value}"`));
    }
  });

  it("keeps TabsContent for every removed module so deep links still work", () => {
    for (const value of REMOVED_TRIGGER_VALUES) {
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

  it("hash / tab sync still activates module panels without top triggers", () => {
    assert.match(detail, /setActiveTab\(tab\)/);
    assert.match(detail, /hashchange/);
    assert.match(detail, /window\.location\.hash = tab/);
  });
});
