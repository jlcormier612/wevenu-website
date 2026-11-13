/**
 * Package add-on commercial path — accept must not book a new venue relationship.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(p), "utf8");

const BOOKED_WRITES = /book_relationship|bookClient\(|sales_stage:\s*["']booked["']/;

describe("Package add-on path — no new booking", () => {
  it("commercial selection accept does not call bookClient", () => {
    const src = read("lib/commercial-selections/service.ts");
    assert.match(src, /markSelectionAccepted|markAccepted/);
    assert.doesNotMatch(src, BOOKED_WRITES);
  });

  it("offer accept action does not book", () => {
    const src = read("app/offer/actions.ts");
    assert.match(src, /acceptOfferAction/);
    assert.doesNotMatch(src, BOOKED_WRITES);
  });

  it("existing commercial-paths-do-not-book suite covers proposal + payment", () => {
    const src = read("lib/booking-journey/commercial-paths-do-not-book.test.ts");
    assert.match(src, /proposal acceptance does not book/);
    assert.match(src, /offer acceptance does not book/);
    assert.match(src, /staff payment does not book/);
  });
});

describe("Saved starting lists Use on event (share from event)", () => {
  it("keeps sendInventoryTemplate capability but demotes Library Send CTA", () => {
    const service = read("lib/event-inventory/service.ts");
    assert.match(service, /export async function sendInventoryTemplate/);
    assert.match(service, /shareEventInventory/);
    const actions = read("app/(app)/events/[id]/event-inventory-actions.ts");
    assert.match(actions, /sendInventoryTemplateAction/);
    const list = read("components/event-inventory/inventory-template-list.tsx");
    assert.match(list, /ensureEventInventoryAction/);
    assert.match(list, /Use on event/);
    assert.doesNotMatch(list, /id: "send"/);
  });
});
