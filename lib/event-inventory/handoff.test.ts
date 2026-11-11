import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  eventInventoryItemsPendingForEventOrder,
  inventoryHandoffBillableTotal,
  isInventoryItemBillableForInvoice,
} from "@/lib/event-inventory/handoff";

describe("Event Inventory → Event Order handoff", () => {
  const chairs = {
    id: "inv-chairs",
    isIncluded: true,
    unitPrice: 0,
    quantity: 150,
    addedToEventOrderAt: null,
  };
  const bar = {
    id: "inv-bar",
    isIncluded: false,
    unitPrice: 600,
    quantity: 1,
    addedToEventOrderAt: null,
  };
  const already = {
    id: "inv-done",
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
});
