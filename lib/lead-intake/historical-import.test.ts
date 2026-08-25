/**
 * Migration Center — Historical Import Mode's automation-suppression gate
 * in ingestLead() (lib/lead-intake/pipeline.ts's shouldAutomate). Real
 * calls against a mock Supabase client tracking which tables are touched,
 * not just typechecking — the whole point of this flag is that a specific
 * side effect (message-sequence enrollment) must NOT fire, so the
 * assertion has to be "this table was never queried," not just "the
 * function returned ok".
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ingestLead } from "@/lib/lead-intake/pipeline";
import type { IngestLeadOptions, RawIntakeInput } from "@/lib/lead-intake/types";

function mockClient() {
  const tableCalls: Record<string, number> = {};

  function chain(): Record<string, unknown> {
    const c: Record<string, unknown> = {};
    const self = () => c;
    c.select = self;
    c.insert = () => ({ ...c, select: () => ({ single: async () => ({ data: { id: "attempt-1" }, error: null }) }) });
    c.update = self;
    c.eq = self;
    c.gte = self;
    c.lte = self;
    c.order = self;
    c.limit = self;
    c.maybeSingle = async () => ({ data: null, error: null });
    c.single = async () => ({ data: { id: "attempt-1" }, error: null });
    // getActiveSequencesForTrigger awaits the query directly (no terminal
    // .single()/.maybeSingle()) — the chain itself needs to be thenable,
    // resolving to an empty result set, so the (non-historical) automation
    // path this test also exercises succeeds cleanly rather than throwing
    // past the pipeline's own try/catch.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    c.then = (resolve: any) => resolve({ data: [], error: null });
    return c;
  }

  const client = {
    from(table: string) {
      tableCalls[table] = (tableCalls[table] ?? 0) + 1;
      return chain();
    },
  };

  return { client, tableCalls };
}

const RAW: RawIntakeInput = {
  firstName: "Jamie", lastName: "Rivera", email: "jamie@example.com", phone: null,
  eventType: "Wedding", eventDate: "2024-05-10",
};

function baseOptions(client: unknown, historicalImport: boolean): IngestLeadOptions {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: client as any,
    venueId: "venue-1",
    source: "generic_csv",
    trustTier: "import",
    historicalImport,
    rawPayload: RAW,
    input: RAW,
    create: async () => ({ ok: true, leadId: "lead-1", relationshipId: "rel-1", isReturningRelationship: false }),
  };
}

describe("ingestLead — Historical Import Mode", () => {
  it("never queries message_sequences (automation) when historicalImport is true", async () => {
    const { client, tableCalls } = mockClient();
    const outcome = await ingestLead(baseOptions(client, true));
    assert.equal(outcome.ok, true);
    assert.equal(tableCalls["message_sequences"] ?? 0, 0, "message_sequences must never be queried for a historical import");
  });

  it("does query message_sequences (automation runs) for a normal, non-historical import", async () => {
    const { client, tableCalls } = mockClient();
    const outcome = await ingestLead(baseOptions(client, false));
    assert.equal(outcome.ok, true);
    assert.ok((tableCalls["message_sequences"] ?? 0) > 0, "message_sequences should be queried for a live (non-historical) create");
  });

  it("defaults to non-historical (loud) when historicalImport is omitted — no accidental suppression", async () => {
    const { client, tableCalls } = mockClient();
    const opts = baseOptions(client, false);
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    delete (opts as Partial<IngestLeadOptions>).historicalImport;
    const outcome = await ingestLead(opts);
    assert.equal(outcome.ok, true);
    assert.ok((tableCalls["message_sequences"] ?? 0) > 0);
  });
});
