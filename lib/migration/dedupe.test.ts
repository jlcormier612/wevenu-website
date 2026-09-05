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
 * Supports the indexed findBySourceId filter path and the paged vendor
 * likely-match scan. Exact-match vendor/client helpers still resolve empty
 * via maybeSingle so tests isolate the likely tier.
 */
function tableMock(responses: Record<string, unknown>) {
  function chain(table: string): Record<string, unknown> {
    const c: Record<string, unknown> = {};
    const self = () => c;
    let filterSourceId: string | null = null;
    let rangeFrom = 0;
    let rangeTo = 999;
    c.select = self;
    c.eq = self;
    c.neq = self;
    c.ilike = self;
    c.order = self;
    c.limit = self;
    c.filter = (_col: string, _op: string, value: string) => {
      filterSourceId = value;
      return c;
    };
    c.range = (from: number, to: number) => {
      rangeFrom = from;
      rangeTo = to;
      return c;
    };
    c.maybeSingle = async () => {
      if (table === "migration_records" && filterSourceId != null) {
        const rows = (responses.migration_records ?? []) as {
          id: string;
          created_entity_id: string | null;
          normalized_payload: { sourceId?: string };
        }[];
        const hit = rows.find((r) => r.normalized_payload?.sourceId === filterSourceId);
        return {
          data: hit ? { id: hit.id, created_entity_id: hit.created_entity_id } : null,
          error: null,
        };
      }
      return { data: null, error: null };
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    c.then = (resolve: any) => {
      const all = (responses[table] ?? []) as unknown[];
      if (table === "venue_vendor_relationships" || table === "migration_records") {
        return resolve({ data: all.slice(rangeFrom, rangeTo + 1), error: null });
      }
      return resolve({ data: all, error: null });
    };
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
    assert.equal(result.matchConfidence, 75);
    // Identity is structured match fields — callers must not invent validationErrors for display.
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
