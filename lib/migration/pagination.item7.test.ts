/**
 * Item 7 — migration scale / pagination contracts.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fetchAllPages, MIGRATION_PAGE_SIZE } from "@/lib/migration/pagination";
import { findBySourceId, dedupeVendor } from "@/lib/migration/dedupe";
import { listRecords } from "@/lib/migration/repository";
import type { MigrationRecord } from "@/lib/migration/types";

describe("fetchAllPages", () => {
  it("concatenates full pages then a short final page with no duplicates", async () => {
    const pages: number[][] = [
      Array.from({ length: 3 }, (_, i) => i),
      Array.from({ length: 3 }, (_, i) => i + 3),
      [6, 7],
    ];
    let calls = 0;
    const all = await fetchAllPages(async (from, to) => {
      const page = pages[calls++] ?? [];
      assert.equal(to - from + 1, 3);
      return page;
    }, 3);
    assert.deepEqual(all, [0, 1, 2, 3, 4, 5, 6, 7]);
    assert.equal(calls, 3);
  });

  it("returns a single short page unchanged (small migrations identical)", async () => {
    const all = await fetchAllPages(async () => [1, 2], 1000);
    assert.deepEqual(all, [1, 2]);
  });

  it("returns empty when the first page is empty", async () => {
    const all = await fetchAllPages(async () => [], 1000);
    assert.deepEqual(all, []);
  });

  it("throws rather than silently accepting an oversized page", async () => {
    await assert.rejects(
      () => fetchAllPages(async () => [1, 2, 3, 4], 3),
      /page returned 4/,
    );
  });
});

/** Chainable mock that supports filter + maybeSingle for findBySourceId and range paging for list/vendor. */
function pagingClient(opts: {
  byFilter?: Record<string, { id: string; created_entity_id: string | null }>;
  pages?: Record<string, unknown>[][];
  vendorPages?: { vendor_id: string; vendors: { id: string; business_name: string } }[][];
}) {
  return {
    from(table: string) {
      const state: {
        filterValue?: string;
        from?: number;
        to?: number;
      } = {};
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      chain.select = self;
      chain.eq = self;
      chain.neq = self;
      chain.ilike = self;
      chain.or = self;
      chain.order = self;
      chain.limit = self;
      chain.filter = (_col: string, _op: string, value: string) => {
        state.filterValue = value;
        return chain;
      };
      chain.range = (from: number, to: number) => {
        state.from = from;
        state.to = to;
        return chain;
      };
      chain.maybeSingle = async () => {
        if (table === "migration_records" && opts.byFilter && state.filterValue) {
          const hit = opts.byFilter[state.filterValue];
          return { data: hit ?? null, error: null };
        }
        return { data: null, error: null };
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chain.then = (resolve: any) => {
        if (table === "migration_records" && opts.pages && state.from != null) {
          const pageIndex = Math.floor(state.from / MIGRATION_PAGE_SIZE);
          const page = opts.pages[pageIndex] ?? [];
          return resolve({ data: page, error: null });
        }
        if (table === "venue_vendor_relationships" && opts.vendorPages && state.from != null) {
          const pageSize = state.to! - state.from + 1;
          const pageIndex = Math.floor(state.from / pageSize);
          const page = opts.vendorPages[pageIndex] ?? [];
          return resolve({ data: page, error: null });
        }
        return resolve({ data: [], error: null });
      };
      return chain;
    },
  };
}

function mapLikeRow(id: string, sessionId: string, i: number): Record<string, unknown> {
  return {
    id,
    session_id: sessionId,
    venue_id: "venue-1",
    source_row_ref: `row ${i}`,
    raw_payload: {},
    target_entity_type: "client",
    normalized_payload: { firstName: "A", lastName: String(i) },
    status: "validated",
    match_type: "none",
    matched_entity_id: null,
    match_confidence: null,
    conflict_fields: null,
    validation_errors: null,
    created_entity_id: null,
    reviewed_by: null,
    reviewed_at: null,
    committed_at: null,
    claimed_at: null,
    claimed_by: null,
    created_at: new Date(2026, 0, 1, 0, 0, i).toISOString(),
  };
}

describe("findBySourceId — indexed filter (no 500-row silent miss)", () => {
  it("returns null when no sourceId is given", async () => {
    const client = pagingClient({});
    assert.equal(await findBySourceId(client as never, "venue-1", null), null);
  });

  it("finds a match beyond the old 500-row scan window via jsonb filter", async () => {
    const client = pagingClient({
      byFilter: {
        "PP-past-500": { id: "rec-late", created_entity_id: "entity-late" },
      },
    });
    const result = await findBySourceId(client as never, "venue-1", "PP-past-500");
    assert.deepEqual(result, { recordId: "rec-late", createdEntityId: "entity-late" });
  });

  it("returns null when the filter finds nothing", async () => {
    const client = pagingClient({ byFilter: {} });
    assert.equal(await findBySourceId(client as never, "venue-1", "missing"), null);
  });
});

describe("listRecords — pages past the old 5000 cap", () => {
  it("returns every row across multiple pages without duplicates", async () => {
    const page0 = Array.from({ length: MIGRATION_PAGE_SIZE }, (_, i) => mapLikeRow(`id-${i}`, "s1", i));
    const page1 = Array.from({ length: 50 }, (_, i) => mapLikeRow(`id-${MIGRATION_PAGE_SIZE + i}`, "s1", MIGRATION_PAGE_SIZE + i));
    const client = pagingClient({ pages: [page0, page1] });
    const rows = await listRecords(client as never, "s1");
    assert.equal(rows.length, MIGRATION_PAGE_SIZE + 50);
    assert.equal(new Set(rows.map((r: MigrationRecord) => r.id)).size, rows.length);
    assert.equal(rows[0].id, "id-0");
    assert.equal(rows[rows.length - 1].id, `id-${MIGRATION_PAGE_SIZE + 49}`);
  });

  it("behaves identically for a small single-page session", async () => {
    const page0 = [mapLikeRow("a", "s1", 0), mapLikeRow("b", "s1", 1)];
    const client = pagingClient({ pages: [page0] });
    const rows = await listRecords(client as never, "s1");
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map((r) => r.id), ["a", "b"]);
  });
});

describe("dedupeVendor likely tier — pages past the old 200 cap", () => {
  it("finds a likely match on a later page", async () => {
    const pageSize = MIGRATION_PAGE_SIZE;
    const filler = Array.from({ length: pageSize }, (_, i) => ({
      vendor_id: `v-fill-${i}`,
      vendors: { id: `v-fill-${i}`, business_name: `Other Vendor ${i}` },
    }));
    const hit = [{
      vendor_id: "vendor-hit",
      vendors: { id: "vendor-hit", business_name: "Bloom & Co Florals" },
    }];
    const client = pagingClient({
      byFilter: {},
      vendorPages: [filler, hit],
    });
    // maybeSingle for exact vendor check returns null via empty filter path;
    // findBySourceId returns null; likely loop pages vendors.
    const result = await dedupeVendor(client as never, "venue-1", { businessName: "bloom &  co   florals," });
    assert.equal(result.matchType, "likely");
    assert.equal(result.matchedEntityId, "vendor-hit");
    assert.equal(result.matchConfidence, 75);
  });
});

describe("default page size", () => {
  it("uses 1000 as the migration page size (above prior silent caps when paged)", () => {
    assert.equal(MIGRATION_PAGE_SIZE, 1000);
  });
});
