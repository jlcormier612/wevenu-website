import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildHandoffPreviewRows,
  eventInventoryItemsPendingForEventOrder,
  findAdvisoryNameMatch,
  inventoryHandoffBillableTotal,
  isInventoryItemBillableForInvoice,
} from "@/lib/event-inventory/handoff";

describe("Event Inventory → Event Order handoff", () => {
  const chairs = {
    id: "inv-chairs",
    name: "Chiavari Chair",
    isIncluded: true,
    unitPrice: 0,
    quantity: 150,
    addedToEventOrderAt: null,
  };
  const bar = {
    id: "inv-bar",
    name: "Bar package",
    isIncluded: false,
    unitPrice: 600,
    quantity: 1,
    addedToEventOrderAt: null,
  };
  const already = {
    id: "inv-done",
    name: "Already transferred",
    isIncluded: false,
    unitPrice: 400,
    quantity: 1,
    addedToEventOrderAt: "2026-10-01T00:00:00Z",
  };

  it("includes included/$0 items in the Event Order handoff", () => {
    const pending = eventInventoryItemsPendingForEventOrder([chairs, bar, already]);
    assert.deepEqual(pending.map((i) => i.id), ["inv-chairs", "inv-bar"]);
    assert.equal(isInventoryItemBillableForInvoice(chairs), false);
    assert.equal(isInventoryItemBillableForInvoice(bar), true);
    assert.equal(inventoryHandoffBillableTotal(pending), 600);
  });

  it("included-only handoff has $0 billable total", () => {
    assert.equal(inventoryHandoffBillableTotal([chairs]), 0);
  });

  it("treats name matches as advisory and defaults Skip when matched", () => {
    const match = findAdvisoryNameMatch("Chiavari Chair", [
      { id: "eo-1", description: "chiavari  chair", isIncluded: false },
    ]);
    assert.equal(match?.id, "eo-1");
    const rows = buildHandoffPreviewRows(
      eventInventoryItemsPendingForEventOrder([chairs, bar]) as Array<typeof chairs>,
      [{ id: "eo-1", description: "Chiavari Chair" }],
    );
    assert.equal(rows.find((r) => r.itemId === "inv-chairs")?.defaultAction, "skip");
    assert.equal(rows.find((r) => r.itemId === "inv-bar")?.defaultAction, "add");
    assert.equal(rows.find((r) => r.itemId === "inv-chairs")?.possibleMatch?.lineId, "eo-1");
  });

  it("does not treat previously transferred items as pending again", () => {
    const pending = eventInventoryItemsPendingForEventOrder([already, chairs]);
    assert.deepEqual(pending.map((i) => i.id), ["inv-chairs"]);
  });
});
