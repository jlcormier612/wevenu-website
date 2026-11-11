import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  INVENTORY_SELECT_SHARE_CONFIG_ERROR,
  resolveInventoryShareMode,
} from "@/lib/event-inventory/share-mode";

const panel = readFileSync(
  resolve("components/event-inventory/event-inventory-panel.tsx"),
  "utf8",
);
const service = readFileSync(resolve("lib/event-inventory/service.ts"), "utf8");
const actions = readFileSync(
  resolve("app/(app)/events/[id]/event-inventory-actions.ts"),
  "utf8",
);

describe("Inventory unified share mode", () => {
  it("resolves review-only when no items are client-selectable", () => {
    assert.equal(
      resolveInventoryShareMode([
        { clientSelectable: false },
        { clientSelectable: false },
      ]),
      "view",
    );
    assert.equal(resolveInventoryShareMode([]), "view");
  });

  it("resolves selection when any Additional item is marked Select", () => {
    assert.equal(
      resolveInventoryShareMode([
        { clientSelectable: false },
        { clientSelectable: true },
      ]),
      "select",
    );
  });

  it("exposes a clear config error for forced select with no choices", () => {
    assert.match(INVENTORY_SELECT_SHARE_CONFIG_ERROR, /marked Select/i);
    assert.match(service, /INVENTORY_SELECT_SHARE_CONFIG_ERROR/);
    assert.match(service, /resolveInventoryShareMode/);
  });

  it("venue UI exposes one Share inventory action and no obsolete dual send controls", () => {
    assert.match(panel, /data-testid="inventory-share"/);
    assert.match(panel, /Share inventory/);
    assert.doesNotMatch(panel, /Share to view/);
    assert.doesNotMatch(panel, /Share for selection/);
    assert.doesNotMatch(panel, /inventory-share-to-view/);
    assert.doesNotMatch(panel, /inventory-share-for-selection/);
    assert.match(panel, /inventory-share-review-only-hint/);
    assert.match(panel, /inventory-share-selection-ready/);
  });

  it("share action defaults to document-driven mode (no required mode argument)", () => {
    assert.match(actions, /collaborationMode\?:/);
    assert.match(
      actions,
      /shareEventInventory\(\s*eventInventoryId,\s*collaborationMode \? \{ collaborationMode \} : undefined,\s*\)/,
    );
  });
});
