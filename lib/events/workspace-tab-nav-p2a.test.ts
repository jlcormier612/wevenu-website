/**
 * P2-A — Venue event workspace tab rows + cards (source contract).
 * Does not change commercial send/finalize/invoice behavior.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

const detail = readFileSync(resolve("components/events/event-detail.tsx"), "utf8");
const portal = readFileSync(resolve("components/portal/portal-shell.tsx"), "utf8");
const setup = readFileSync(resolve("components/events/event-setup-panel.tsx"), "utf8");

function row1Block(): string {
  const start = detail.indexOf('data-testid="booked-tab-row-1"');
  const end = detail.indexOf('data-testid="booked-tab-row-2"');
  assert.ok(start > 0 && end > start);
  return detail.slice(start, end);
}

function row2Block(): string {
  const start = detail.indexOf('data-testid="booked-tab-row-2"');
  const end = detail.indexOf("daysUntil(event.eventDate)", start);
  assert.ok(start > 0 && end > start);
  return detail.slice(start, end);
}

describe("P2-A venue workspace tab rows", () => {
  it("row 1 is Planning Overview → Planning Tasks → Timeline → Floor Plans → Vendors", () => {
    const row = row1Block();
    assert.match(row, /grid-cols-5/);
    assert.match(row, /value="overview"[^>]*>Planning Overview</);
    assert.match(row, /value="playbook"[^>]*>Planning Tasks</);
    assert.match(row, /value="timeline"[^>]*>Timeline</);
    assert.match(row, /value="floorplan"[^>]*>Floor Plans</);
    assert.match(row, /value="vendors"[^>]*>Vendors</);
    assert.doesNotMatch(row, /value="inventory"/);
    assert.doesNotMatch(row, /value="event-order"/);
  });

  it("row 2 is Documents → Payments → Conversation → Activity → notes → Luv (no Questionnaires)", () => {
    const row = row2Block();
    assert.match(row, /grid-cols-6/);
    assert.match(row, /value="documents"/);
    assert.match(row, /value="invoice"/);
    assert.match(row, /value="messages"[^>]*>Conversation</);
    assert.match(row, /value="activity"/);
    assert.match(row, /value="notes"/);
    assert.match(row, /value="luv"/);
    assert.doesNotMatch(row, /value="questionnaires"/);
    assert.doesNotMatch(row, /value="inventory"/);
    assert.doesNotMatch(row, /value="event-order"/);
  });

  it("keeps Questionnaires / Inventory / Event Order as hash-addressable TabsContent", () => {
    assert.match(detail, /TabsContent value="questionnaires"/);
    assert.match(detail, /TabsContent value="inventory"/);
    assert.match(detail, /TabsContent value="event-order"/);
    assert.match(detail, /QuestionnaireFamilyPanel/);
    assert.match(detail, /EventInventoryPanel/);
    // P2-B composes Choices + EO into EventCommercialWorkflow (panels still mounted inside).
    assert.match(detail, /EventCommercialWorkflow/);
    const workflow = readFileSync(
      resolve("components/event-orders/event-commercial-workflow.tsx"),
      "utf8",
    );
    assert.match(workflow, /EventOrderPanel/);
    assert.match(workflow, /ClientChoicesPanel/);
  });

  it("exposes Questionnaires and Inventory & Event Order workspace cards", () => {
    assert.match(detail, /data-testid="event-questionnaires-card"/);
    assert.match(detail, /data-testid="event-inventory-event-order-card"/);
    assert.match(detail, /data-testid="open-questionnaires-card"/);
    assert.match(detail, /data-testid="open-event-order-card"/);
    assert.match(detail, /data-testid="open-inventory-card"/);
    assert.match(detail, /setActiveTab\("questionnaires"\)/);
    assert.match(detail, /setActiveTab\("event-order"\)/);
    assert.match(detail, /setActiveTab\("inventory"\)/);
  });

  it("preserves commercial deep-link hash handling", () => {
    assert.match(detail, /event-order-choices/);
    assert.match(detail, /event-order-order/);
    assert.match(detail, /event-order-invoice/);
    assert.match(detail, /planning-task-list/);
  });
});

describe("P2-A setup copy and couple portal gating", () => {
  it("setup copy points at the Inventory & Event Order card, not tabs", () => {
    assert.match(setup, /Inventory &amp; Event Order card|Inventory & Event Order card/);
    assert.doesNotMatch(setup, /Inventory and Event Order tabs/);
  });

  it("couple portal P2-D Documents-first: hide passive Inventory/Order; keep deep-link mounts", () => {
    // P2-D superseded P2-A share-only Order tabs with lifecycle-aware helpers.
    assert.match(portal, /coupleInventoryNavVisible/);
    assert.match(portal, /coupleEventOrderNavVisible/);
    assert.match(portal, /coupleChoicesNavVisible/);
    assert.match(portal, /item\.id !== "inventory" \|\| showInventoryNav/);
    assert.match(portal, /item\.id !== "event-order" \|\| showEventOrderNav/);
    assert.match(portal, /Documents-first|P2-D/);
    // Sections remain mountable for email / task deep links when nav is hidden.
    assert.match(portal, /activeSection === "inventory"/);
    assert.match(portal, /activeSection === "event-order"/);
    assert.match(portal, /activeSection === "choices"/);
  });
});
