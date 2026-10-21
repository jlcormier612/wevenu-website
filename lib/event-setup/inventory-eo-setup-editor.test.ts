/**
 * Inventory + Event Order event-specific setup editors — Change ≠ Open.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const panel = readFileSync(resolve("components/events/event-setup-panel.tsx"), "utf8");
const invEditor = readFileSync(resolve("components/events/event-inventory-setup-editor.tsx"), "utf8");
const eoEditor = readFileSync(resolve("components/events/event-order-setup-editor.tsx"), "utf8");
const invActions = readFileSync(resolve("app/(app)/events/[id]/event-inventory-actions.ts"), "utf8");
const eoActions = readFileSync(resolve("app/(app)/events/[id]/event-order-actions.ts"), "utf8");
const invService = readFileSync(resolve("lib/event-inventory/service.ts"), "utf8");
const eoService = readFileSync(resolve("lib/event-orders/service.ts"), "utf8");
const invRepo = readFileSync(resolve("lib/event-inventory/repository.ts"), "utf8");
const eoRepo = readFileSync(resolve("lib/event-orders/repository.ts"), "utf8");
const prepare = readFileSync(resolve("lib/event-setup/prepare-release.ts"), "utf8");
const detail = readFileSync(resolve("components/events/event-detail.tsx"), "utf8");

describe("Inventory + Event Order Change vs Open destinations", () => {
  it("SETUP_EDITOR_STEPS includes inventory and event_order", () => {
    assert.match(panel, /"inventory", "event_order", "floor_plans", "vendors"/);
  });

  it("Change for inventory opens the dedicated inventory setup editor", () => {
    assert.match(panel, /setInventoryEditorOpen\(true\)/);
    assert.match(panel, /EventInventorySetupEditor/);
    assert.match(invEditor, /data-testid="event-inventory-setup-editor"/);
    const changeFn = panel.slice(panel.indexOf("function changeForEvent"));
    assert.doesNotMatch(changeFn.slice(0, 900), /navigateStep\("inventory"\)/);
  });

  it("Change for Event Order opens the dedicated Event Order setup editor", () => {
    assert.match(panel, /setEventOrderEditorOpen\(true\)/);
    assert.match(panel, /EventOrderSetupEditor/);
    assert.match(eoEditor, /data-testid="event-order-setup-editor"/);
  });

  it("Open Inventory / Open Event Order still navigate to management tabs", () => {
    assert.match(panel, /Open Inventory/);
    assert.match(panel, /Open Event Order/);
    assert.match(panel, /step === "inventory" \? "inventory"/);
    assert.match(panel, /step === "event_order" \? "event-order"/);
    assert.match(panel, /data-testid=\{`event-setup-open-\$\{step\}`\}/);
  });

  it("event-detail passes inventory and Event Order details into the setup panel", () => {
    assert.match(detail, /eventInventory=\{eventInventory\}/);
    assert.match(detail, /inventoryTemplates=\{inventoryTemplates\}/);
    assert.match(detail, /eventOrderDetails=\{eventOrder\}/);
    assert.match(detail, /eventOrderTemplates=\{eventOrderTemplates\}/);
  });
});

describe("Inventory setup editor seams", () => {
  it("offers template switch and customize without share/finalize/invoice", () => {
    assert.match(invEditor, /inventory-setup-mode-template/);
    assert.match(invEditor, /inventory-setup-mode-customize/);
    assert.match(invEditor, /replaceEventInventoryFromTemplateAction/);
    assert.match(invEditor, /ensureEventInventoryAction/);
    assert.match(invEditor, /addEventInventoryItemAction/);
    assert.match(invEditor, /updateEventInventoryItemAction/);
    assert.match(invEditor, /removeEventInventoryItemAction/);
    assert.doesNotMatch(invEditor, /shareEventInventoryAction/);
    assert.doesNotMatch(invEditor, /finalizeEventInventoryAction/);
    assert.doesNotMatch(invEditor, /createInvoice/);
    assert.doesNotMatch(invEditor, /Invite client/);
  });

  it("replace clears items then applies template; blocks shared/finalized and EO-pushed items", () => {
    assert.match(invService, /export async function replaceEventInventoryFromTemplate/);
    assert.match(invService, /clearEventInventoryItems/);
    assert.match(invService, /setEventInventoryTemplateId/);
    assert.match(invService, /applyTemplateItems/);
    assert.match(invService, /addedToEventOrderAt/);
    assert.match(invService, /status !== "draft"/);
    assert.match(invRepo, /clearEventInventoryItems/);
    assert.match(invActions, /replaceEventInventoryFromTemplateAction/);
  });

  it("ensure remains idempotent and panel does not call ensure directly", () => {
    assert.match(invService, /if \(existing\) return \{ ok: true, eventInventoryId: existing\.id \}/);
    assert.doesNotMatch(panel, /ensureEventInventoryAction/);
  });
});

describe("Event Order setup editor seams", () => {
  it("offers package switch and customize without share/finalize/invoice", () => {
    assert.match(eoEditor, /event-order-setup-mode-template/);
    assert.match(eoEditor, /event-order-setup-mode-customize/);
    assert.match(eoEditor, /replaceEventOrderFromTemplateAction/);
    assert.match(eoEditor, /ensureEventOrderAction/);
    assert.match(eoEditor, /addCustomLineAction/);
    assert.match(eoEditor, /updateLineAction/);
    assert.match(eoEditor, /removeLineAction/);
    assert.doesNotMatch(eoEditor, /finalizeEventOrderAction/);
    assert.doesNotMatch(eoEditor, /shareEventOrderWithClient/);
    assert.doesNotMatch(eoEditor, /createInvoiceFromEventOrderAction/);
    assert.doesNotMatch(eoEditor, /Invite client/);
  });

  it("replace clears contents then copies package; blocks finalized/shared", () => {
    assert.match(eoService, /export async function replaceEventOrderFromTemplate/);
    assert.match(eoService, /clearEventOrderContents/);
    assert.match(eoService, /setEventOrderTemplateId/);
    assert.match(eoService, /status !== "open"/);
    assert.match(eoService, /sharedAt/);
    assert.match(eoRepo, /clearEventOrderContents/);
    assert.match(eoActions, /replaceEventOrderFromTemplateAction/);
  });

  it("panel does not call ensureEventOrderAction; release path stays separate", () => {
    assert.doesNotMatch(panel, /ensureEventOrderAction/);
    assert.match(prepare, /ensureEventOrder/);
    assert.match(prepare, /ensureEventInventory/);
    assert.doesNotMatch(prepare, /shareEventInventory/);
    assert.doesNotMatch(prepare, /finalizeEventOrder/);
    assert.doesNotMatch(prepare, /createInvoice/);
  });
});
