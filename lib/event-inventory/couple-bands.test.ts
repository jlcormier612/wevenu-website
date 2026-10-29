/**
 * R1 — every inventory row lands in exactly one couple-facing band, using the
 * same rules as the couple portal and the Select service guard.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  INVENTORY_COUPLE_BAND_ORDER,
  INVENTORY_VISIBILITY_DISCLOSURE,
  groupInventoryByCoupleBand,
  inventoryCoupleBand,
  inventoryCoupleMaxQuantity,
} from "@/lib/event-inventory/couple-bands";

const panel = readFileSync(resolve("components/event-inventory/event-inventory-panel.tsx"), "utf8");
const templateDetail = readFileSync(resolve("components/event-inventory/inventory-template-detail.tsx"), "utf8");
const service = readFileSync(resolve("lib/event-inventory/service.ts"), "utf8");
const portal = readFileSync(resolve("components/portal/inventory-view.tsx"), "utf8");

describe("inventory couple bands", () => {
  it("selectable additional item → Couple can choose, max from maxQuantity", () => {
    const row = { isIncluded: false, clientSelectable: true, quantity: 20, maxQuantity: 40 };
    assert.equal(inventoryCoupleBand(row), "couple_can_choose");
    assert.equal(inventoryCoupleMaxQuantity(row), 40);
  });

  it("selectable additional item without maxQuantity → cap is quantity (portal rule)", () => {
    const row = { isIncluded: false, clientSelectable: true, quantity: 12, maxQuantity: null };
    assert.equal(inventoryCoupleBand(row), "couple_can_choose");
    assert.equal(inventoryCoupleMaxQuantity(row), 12);
    assert.match(portal, /item\.maxQuantity \?\? item\.quantity/);
  });

  it("non-selectable additional item → Additional — venue sets, no cap", () => {
    const row = { isIncluded: false, clientSelectable: false, quantity: 5, maxQuantity: null };
    assert.equal(inventoryCoupleBand(row), "additional_venue_sets");
    assert.equal(inventoryCoupleMaxQuantity(row), null);
  });

  it("included item → Included", () => {
    assert.equal(inventoryCoupleBand({ isIncluded: true, clientSelectable: false, quantity: 120 }), "included");
  });

  it("conflicting included + selectable → Included (portal never offers it; service refuses it)", () => {
    const row = { isIncluded: true, clientSelectable: true, quantity: 10, maxQuantity: 10 };
    assert.equal(inventoryCoupleBand(row), "included");
    assert.equal(inventoryCoupleMaxQuantity(row), null);
    assert.match(service, /if \(clientSelectable && item\.isIncluded\)/);
    assert.match(portal, /const selectable = additional\.filter\(\(i\) => i\.clientSelectable\)/);
  });

  it("missing selectable flag (Library template rows) → never Couple can choose", () => {
    assert.equal(inventoryCoupleBand({ isIncluded: false, quantity: 3 }), "additional_venue_sets");
    assert.equal(inventoryCoupleBand({ isIncluded: true, quantity: 3 }), "included");
    assert.equal(inventoryCoupleBand({ isIncluded: false, clientSelectable: null, quantity: 3 }), "additional_venue_sets");
  });

  it("missing isIncluded is treated as not included, the same truthiness the panel and portal use", () => {
    assert.equal(inventoryCoupleBand({ isIncluded: null, clientSelectable: false, quantity: 1 }), "additional_venue_sets");
    assert.equal(inventoryCoupleBand({ isIncluded: undefined, clientSelectable: true, quantity: 1 }), "couple_can_choose");
  });

  it("groups every row into exactly one band, keeps order, omits empty bands", () => {
    const rows = [
      { id: "a", isIncluded: true, clientSelectable: false, quantity: 120 },
      { id: "b", isIncluded: false, clientSelectable: true, quantity: 20, maxQuantity: null },
      { id: "c", isIncluded: false, clientSelectable: false, quantity: 2 },
      { id: "d", isIncluded: true, clientSelectable: false, quantity: 15 },
    ];
    const groups = groupInventoryByCoupleBand(rows);
    assert.deepEqual(groups.map((g) => g.band), [...INVENTORY_COUPLE_BAND_ORDER]);
    assert.deepEqual(groups.map((g) => g.rows.map((r) => r.id)), [["b"], ["a", "d"], ["c"]]);
    const ids = groups.flatMap((g) => g.rows.map((r) => r.id)).sort();
    assert.deepEqual(ids, ["a", "b", "c", "d"]);

    const onlyIncluded = groupInventoryByCoupleBand([rows[0]!]);
    assert.deepEqual(onlyIncluded.map((g) => g.band), ["included"]);
    assert.deepEqual(groupInventoryByCoupleBand([]), []);
  });

  it("does not mutate input rows or the input array", () => {
    const rows = Object.freeze([
      Object.freeze({ id: "x", isIncluded: false, clientSelectable: true, quantity: 4, maxQuantity: null }),
      Object.freeze({ id: "y", isIncluded: true, clientSelectable: false, quantity: 9 }),
    ]);
    const snapshot = JSON.stringify(rows);
    groupInventoryByCoupleBand(rows);
    inventoryCoupleBand(rows[0]!);
    inventoryCoupleMaxQuantity(rows[0]!);
    assert.equal(JSON.stringify(rows), snapshot);
  });

  it("Library template and its applied event copy classify the same", () => {
    // applyTemplateItems copies isIncluded; event rows start with client_selectable=false.
    const templateRows = [
      { isIncluded: true, quantity: 120 },
      { isIncluded: false, quantity: 15 },
    ];
    const eventCopy = templateRows.map((r) => ({ ...r, clientSelectable: false, maxQuantity: null }));
    assert.deepEqual(templateRows.map(inventoryCoupleBand), eventCopy.map(inventoryCoupleBand));
  });
});

describe("inventory surfaces use the shared bands", () => {
  it("Inventory tab renders bands and the visibility disclosure", () => {
    assert.match(panel, /groupInventoryByCoupleBand\(items\)/);
    assert.match(panel, /inventory-visibility-disclosure/);
    assert.match(panel, /INVENTORY_VISIBILITY_DISCLOSURE/);
    assert.match(INVENTORY_VISIBILITY_DISCLOSURE, /All inventory rows are currently visible to the couple/);
    assert.doesNotMatch(panel, /Venue only/);
  });

  it("Inventory tab keeps Select restricted to Additional rows", () => {
    assert.match(panel, /!item\.isIncluded && onToggleSelectable/);
    assert.match(panel, /setInventoryItemClientSelectableAction/);
  });

  it("Library template detail uses the same classifier", () => {
    assert.match(templateDetail, /groupInventoryByCoupleBand\(template\.items\)/);
  });

  it("viewing the bands adds no new writes to the Inventory tab", () => {
    const actionCalls = panel.match(/[A-Za-z]+Action\(/g) ?? [];
    assert.deepEqual(
      [...new Set(actionCalls)].sort(),
      [
        "addEventInventoryToEventOrderAction(",
        "confirmInventorySelectionsAction(",
        "ensureEventInventoryAction(",
        "finalizeEventInventoryAction(",
        "removeEventInventoryItemAction(",
        "reopenEventInventoryAction(",
        "requestInventorySelectionChangesAction(",
        "setInventoryItemClientSelectableAction(",
        "shareEventInventoryAction(",
      ],
    );
  });
});
