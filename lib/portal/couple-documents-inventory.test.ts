import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeFinalizedInventoryIntoCoupleDocuments } from "@/lib/portal/couple-documents-inventory";

describe("mergeFinalizedInventoryIntoCoupleDocuments", () => {
  it("ignores non-finalized inventory", () => {
    const base = [{ id: "x", docType: "upload", name: "File" }];
    assert.deepEqual(
      mergeFinalizedInventoryIntoCoupleDocuments(base, {
        id: "inv1",
        status: "shared",
        finalizedAt: null,
      }),
      base,
    );
  });

  it("prepends finalized inventory once", () => {
    const base = [{ id: "x", docType: "upload", name: "File" }];
    const merged = mergeFinalizedInventoryIntoCoupleDocuments(base, {
      id: "inv1",
      status: "finalized",
      finalizedAt: "2026-10-28T00:00:00Z",
    });
    assert.equal(merged[0].docType, "event_inventory");
    assert.equal(merged[0].id, "event-inventory:inv1");
    assert.equal(merged[0].portalSection, "inventory");
    const again = mergeFinalizedInventoryIntoCoupleDocuments(merged, {
      id: "inv1",
      status: "finalized",
      finalizedAt: "2026-10-28T00:00:00Z",
    });
    assert.equal(again.filter((d) => d.docType === "event_inventory").length, 1);
  });
});
