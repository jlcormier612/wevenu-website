import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve("supabase/migrations/20261422400000_event_inventory_client_selection.sql"),
  "utf8",
);
const types = readFileSync(resolve("lib/event-inventory/types.ts"), "utf8");
const service = readFileSync(resolve("lib/event-inventory/service.ts"), "utf8");
const repo = readFileSync(resolve("lib/event-inventory/repository.ts"), "utf8");
const actions = readFileSync(resolve("app/(app)/events/[id]/event-inventory-actions.ts"), "utf8");
const panel = readFileSync(resolve("components/event-inventory/event-inventory-panel.tsx"), "utf8");
const portalView = readFileSync(resolve("components/portal/inventory-view.tsx"), "utf8");
const portalGet = readFileSync(resolve("app/api/portal/inventory/route.ts"), "utf8");
const portalSave = readFileSync(resolve("app/api/portal/inventory/save/route.ts"), "utf8");
const portalSubmit = readFileSync(resolve("app/api/portal/inventory/submit/route.ts"), "utf8");
const handoff = readFileSync(resolve("lib/event-inventory/handoff.ts"), "utf8");

describe("Event Inventory client selection (Workflow C)", () => {
  it("migration adds collaboration mode, selection columns, and portal RPCs", () => {
    assert.match(migration, /collaboration_mode/);
    assert.match(migration, /client_selectable/);
    assert.match(migration, /client_draft_quantity/);
    assert.match(migration, /client_submitted_quantity/);
    assert.match(migration, /save_event_inventory_selections_for_portal/);
    assert.match(migration, /submit_event_inventory_selections_for_portal/);
    assert.match(migration, /'submitted'/);
    assert.match(migration, /'changes_requested'/);
    assert.match(migration, /'confirmed'/);
    assert.match(migration, /collaboration_mode <> 'select'/);
    assert.match(migration, /Quantity exceeds the allowed maximum/);
  });

  it("types and repository map selection fields", () => {
    assert.match(types, /EventInventoryCollaborationMode/);
    assert.match(types, /clientSelectable/);
    assert.match(types, /clientDraftQuantity/);
    assert.match(types, /clientSubmittedQuantity/);
    assert.match(repo, /setCollaborationMode/);
    assert.match(repo, /setItemClientSelectable/);
    assert.match(repo, /applySubmittedQuantities/);
    assert.match(repo, /client_selectable/);
  });

  it("venue service enforces select share, confirm, and finalize gates", () => {
    assert.match(service, /collaborationMode/);
    assert.match(service, /Mark at least one additional item/);
    assert.match(service, /Included items stay informational/);
    assert.match(service, /confirmInventorySelections/);
    assert.match(service, /requestInventorySelectionChanges/);
    assert.match(service, /Confirm or request changes on the couple/);
    assert.match(service, /recordExternalClientOutbound/);
    assert.match(service, /event_inventory_shared/);
  });

  it("venue actions and panel expose share-for-selection and confirm", () => {
    assert.match(actions, /shareEventInventoryAction/);
    assert.match(actions, /confirmInventorySelectionsAction/);
    assert.match(actions, /setInventoryItemClientSelectableAction/);
    assert.match(panel, /Share for selection/);
    assert.match(panel, /Confirm selections/);
    assert.match(panel, /Request changes/);
    assert.match(panel, /runLifecycle/);
    assert.match(panel, /router\.refresh\(\)/);
  });

  it("portal APIs wire save/submit RPCs and return collaboration fields", () => {
    assert.match(portalGet, /collaborationMode/);
    assert.match(portalGet, /clientSelectable/);
    assert.match(portalSave, /save_event_inventory_selections_for_portal/);
    assert.match(portalSubmit, /submit_event_inventory_selections_for_portal/);
    assert.match(portalView, /inventory-save-draft/);
    assert.match(portalView, /inventory-submit/);
    assert.match(portalView, /Included — no extra charge/);
    assert.match(portalView, /Additional fee/);
    assert.match(portalView, /inventory-portal-intro/);
  });

  it("EO handoff still treats included items as non-billable", () => {
    assert.match(handoff, /isIncluded/);
    assert.match(handoff, /isInventoryItemBillableForInvoice/);
  });
});
