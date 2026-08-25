/**
 * Migration Center — duplicate & conflict strategy. Focused on the two
 * pieces this workstream actually added: the repeat-import source-id
 * short-circuit, and the vendor "likely match" tier (the sharpest existing
 * gap the architecture audit found — vendors had no fuzzy signal at all).
 * Real calls against a mock Supabase client keyed by table name, not just
 * typechecking.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dedupeVendor, findBySourceId } from "@/lib/migration/dedupe";

/**
 * `.maybeSingle()` (the exact-match query's terminal call) always resolves
 * empty here — this mock doesn't implement real ilike semantics, so it
 * models "the exact/ilike check found nothing" directly, letting a test
 * isolate the likely-match loop's own logic (which awaits the chain
 * directly, via `.then`, instead of calling `.maybeSingle()`).
 */
function tableMock(responses: Record<string, unknown>) {
  function chain(table: string): Record<string, unknown> {
    const c: Record<string, unknown> = {};
    const self = () => c;
    c.select = self;
    c.eq = self;
    c.neq = self;
    c.ilike = self;
    c.limit = self;
    c.maybeSingle = async () => ({ data: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    c.then = (resolve: any) => resolve({ data: responses[table] ?? [] });
    return c;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from: (table: string) => chain(table) } as any;
}

describe("findBySourceId", () => {
  it("returns null when no sourceId is given — nothing to short-circuit on", async () => {
    const client = tableMock({});
    const result = await findBySourceId(client, "venue-1", null);
    assert.equal(result, null);
  });

  it("finds a prior committed record with a matching normalized_payload.sourceId", async () => {
    const client = tableMock({
      migration_records: [
        { id: "rec-1", created_entity_id: "vendor-1", normalized_payload: { sourceId: "PP-42" } },
        { id: "rec-2", created_entity_id: "vendor-2", normalized_payload: { sourceId: "PP-99" } },
      ],
    });
    const result = await findBySourceId(client, "venue-1", "PP-99");
    assert.deepEqual(result, { recordId: "rec-2", createdEntityId: "vendor-2" });
  });

  it("returns null when nothing matches the sourceId", async () => {
    const client = tableMock({ migration_records: [{ id: "rec-1", created_entity_id: "v1", normalized_payload: { sourceId: "PP-1" } }] });
    const result = await findBySourceId(client, "venue-1", "PP-DOES-NOT-EXIST");
    assert.equal(result, null);
  });
});

describe("dedupeVendor — likely-match tier", () => {
  it("finds a likely match via normalized business name (case/spacing/punctuation-insensitive) when the exact check finds nothing", async () => {
    const client = tableMock({
      migration_records: [],
      venue_vendor_relationships: [
        { vendor_id: "vendor-9", vendors: { id: "vendor-9", business_name: "Bloom & Co Florals" } },
      ],
    });
    const result = await dedupeVendor(client, "venue-1", { businessName: "bloom &  co   florals," });
    assert.equal(result.matchType, "likely");
    assert.equal(result.matchedEntityId, "vendor-9");
  });

  it("reports no match for a genuinely different business", async () => {
    const client = tableMock({
      migration_records: [],
      venue_vendor_relationships: [
        { vendor_id: "vendor-9", vendors: { id: "vendor-9", business_name: "Bloom & Co Florals" } },
      ],
    });
    const result = await dedupeVendor(client, "venue-1", { businessName: "Sunrise Catering Co" });
    assert.equal(result.matchType, "none");
    assert.equal(result.matchedEntityId, null);
  });
});
