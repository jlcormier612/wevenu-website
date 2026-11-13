/**
 * Saved starting lists page language — demoted Send-to-client; Use on event primary.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(rel: string) {
  return readFileSync(resolve(rel), "utf8");
}

describe("Saved starting lists page copy", () => {
  const page = read("app/(app)/library/inventory-templates/page.tsx");
  const list = read("components/event-inventory/inventory-template-list.tsx");

  it("uses Saved starting lists title and event-first sharing guidance", () => {
    assert.match(page, /title="Saved starting lists"/);
    assert.match(page, /Share quantities with the couple from the event workspace/);
    assert.doesNotMatch(page, /Send to client/);
  });

  it("keeps catalog dependency guidance", () => {
    assert.match(page, /Built from your Available Inventory catalog/);
    assert.match(page, /Manage Available Inventory/);
  });

  it("removes Library-level Send to client primary action", () => {
    assert.doesNotMatch(list, /id: "send"/);
    assert.doesNotMatch(list, /onSend=\{\(\) => setSending/);
    assert.match(list, /Use on event/);
    assert.match(list, /ensureEventInventoryAction/);
  });
});
