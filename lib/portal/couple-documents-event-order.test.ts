/**
 * P2-D — Shared Event Order in couple Documents list.
 * Run: npx tsx --test lib/portal/couple-documents-event-order.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { mergeSharedEventOrderIntoCoupleDocuments } from "@/lib/portal/couple-documents-event-order";

describe("mergeSharedEventOrderIntoCoupleDocuments", () => {
  it("does not expose an unshared or missing order", () => {
    const base = [{ id: "c1", docType: "contract", name: "Contract" }];
    assert.deepEqual(mergeSharedEventOrderIntoCoupleDocuments(base, null), base);
    assert.deepEqual(
      mergeSharedEventOrderIntoCoupleDocuments(base, {
        id: "eo1",
        sharedAt: null,
      }),
      base,
    );
  });

  it("prepends a shared final Event Order alongside other documents", () => {
    const base = [
      { id: "c1", docType: "contract", name: "Contract" },
      { id: "i1", docType: "invoice", name: "Invoice" },
    ];
    const merged = mergeSharedEventOrderIntoCoupleDocuments(base, {
      id: "eo-abc",
      sharedAt: "2026-10-20T12:00:00Z",
      clientAgreedAt: null,
      revision: 2,
    });
    assert.equal(merged.length, 3);
    assert.equal(merged[0].docType, "event_order");
    assert.equal(merged[0].status, "shared");
    assert.equal(merged[0].id, "event-order:eo-abc");
    assert.equal(merged[1].docType, "contract");
    assert.equal(merged[2].docType, "invoice");
  });

  it("marks agreed status when clientAgreedAt is set", () => {
    const merged = mergeSharedEventOrderIntoCoupleDocuments([], {
      id: "eo1",
      sharedAt: "2026-10-20T12:00:00Z",
      clientAgreedAt: "2026-10-21T12:00:00Z",
    });
    assert.equal(merged[0].status, "agreed");
  });

  it("does not duplicate when an event_order row already exists", () => {
    const base = [{ id: "event-order:eo1", docType: "event_order", name: "Event Order" }];
    const merged = mergeSharedEventOrderIntoCoupleDocuments(base, {
      id: "eo1",
      sharedAt: "2026-10-20T12:00:00Z",
    });
    assert.equal(merged.length, 1);
  });
});

describe("P2-D documents UI + route wiring", () => {
  it("couple documents section renders Event Order card and opens event-order", () => {
    const src = readFileSync(resolve("components/portal/couple-documents-section.tsx"), "utf8");
    assert.match(src, /portal-documents-event-order/);
    assert.match(src, /docType === "event_order"/);
    assert.match(src, /onNavigate\?\.\("event-order"\)/);
  });

  it("documents GET merges via get_event_order_for_portal", () => {
    const route = readFileSync(resolve("app/api/portal/documents/route.ts"), "utf8");
    assert.match(route, /get_event_order_for_portal/);
    assert.match(route, /mergeSharedEventOrderIntoCoupleDocuments/);
  });
});
