/**
 * Included package treatment must not hide a configured unit price on the list.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  eventInventoryListPriceLabel,
  formatEventInventoryUnitPrice,
} from "@/lib/event-inventory/list-display";
import { isInventoryItemBillableForInvoice } from "@/lib/event-inventory/handoff";

const panel = readFileSync(resolve("components/event-inventory/event-inventory-panel.tsx"), "utf8");
const sheet = readFileSync(resolve("components/event-inventory/item-sheet.tsx"), "utf8");

describe("event inventory list price vs inclusion", () => {
  it("shows configured price for included DJ/Band-style items (reproduction)", () => {
    const label = eventInventoryListPriceLabel({ unitPrice: 150, isIncluded: true });
    assert.equal(label.price, "$150.00");
    assert.equal(label.inclusionHint, "no extra charge");
    assert.equal(formatEventInventoryUnitPrice(150), "$150.00");
  });

  it("shows configured price for additional items without inclusion hint", () => {
    const label = eventInventoryListPriceLabel({ unitPrice: 40, isIncluded: false });
    assert.equal(label.price, "$40.00");
    assert.equal(label.inclusionHint, null);
  });

  it("uses em dash only when price is null (included or not)", () => {
    assert.equal(eventInventoryListPriceLabel({ unitPrice: null, isIncluded: true }).price, null);
    assert.equal(eventInventoryListPriceLabel({ unitPrice: null, isIncluded: false }).price, null);
  });

  it("does not treat included priced items as billable (no double charge)", () => {
    assert.equal(isInventoryItemBillableForInvoice({ isIncluded: true, unitPrice: 150 }), false);
    assert.equal(isInventoryItemBillableForInvoice({ isIncluded: false, unitPrice: 150 }), true);
  });

  it("panel uses list-display helper instead of hiding price when included", () => {
    assert.match(panel, /eventInventoryListPriceLabel/);
    assert.doesNotMatch(panel, /item\.isIncluded \|\| item\.unitPrice == null/);
  });

  it("ItemSheet refreshes after save so price survives reload", () => {
    assert.match(sheet, /router\.refresh\(\)/);
    assert.match(sheet, /updateEventInventoryItemAction/);
    assert.match(sheet, /inventory-item-price-input/);
    assert.match(sheet, /inventory-item-included-checkbox/);
  });
});
