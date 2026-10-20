/**
 * Quiet-import contract for the standard CSV Import wizard lead path.
 * Historical CSV imports must use the same historicalImport=true gate as
 * Migration Center — suppressing lead_created sequence enrollment and
 * venue new-inquiry notifications — without changing live lead automation.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { ingestLead } from "@/lib/lead-intake/pipeline";
import type { IngestLeadOptions, RawIntakeInput } from "@/lib/lead-intake/types";

const csvImport = readFileSync(resolve("app/(app)/settings/import/actions.ts"), "utf8");
const adminImport = readFileSync(resolve("app/admin/onboarding/import-actions.ts"), "utf8");
const migration = readFileSync(resolve("lib/migration/service.ts"), "utf8");
const leadsService = readFileSync(resolve("lib/leads/service.ts"), "utf8");
const leadsRepo = readFileSync(resolve("lib/leads/repository.ts"), "utf8");
const pipeline = readFileSync(resolve("lib/lead-intake/pipeline.ts"), "utf8");
const notifyTrigger = readFileSync(
  resolve("supabase/migrations/20261418800000_new_lead_notification_event_type_label.sql"),
  "utf8",
);

function sliceImportLeadsAction(): string {
  const start = csvImport.indexOf("export async function importLeadsAction");
  const end = csvImport.indexOf("export async function importVendorsAction");
  assert.ok(start >= 0 && end > start);
  return csvImport.slice(start, end);
}

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    c.then = (resolve: any) => resolve({ data: [], error: null });
    return c;
  }
  return {
    client: {
      from(table: string) {
        tableCalls[table] = (tableCalls[table] ?? 0) + 1;
        return chain();
      },
    },
    tableCalls,
  };
}

const RAW: RawIntakeInput = {
  firstName: "Jamie",
  lastName: "Rivera",
  email: "jamie@example.com",
  phone: null,
  eventType: "Wedding",
  eventDate: "2024-05-10",
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
    create: async () => ({
      ok: true,
      leadId: "lead-1",
      relationshipId: "rel-1",
      isReturningRelationship: false,
    }),
  };
}

describe("CSV Import wizard — quiet lead import", () => {
  it("importLeadsAction passes historicalImport true into createLead", () => {
    const body = sliceImportLeadsAction();
    assert.match(body, /createLead\(\s*row,\s*"import",\s*true\s*\)/);
    assert.doesNotMatch(body, /createLead\(\s*row,\s*"import"\s*\)\s*;/);
  });

  it("Migration Center lead commit keeps historicalImport true", () => {
    assert.match(migration, /createLead\(\s*input,\s*"import",\s*true\s*\)/);
    assert.match(migration, /createLeadForVenue\(\s*session\.venueId,\s*input,\s*true\s*\)/);
  });

  it("HQ createLeadForVenue defaults historicalImport to true", () => {
    assert.match(
      leadsService,
      /export async function createLeadForVenue\([\s\S]*?historicalImport\s*=\s*true/,
    );
    assert.match(adminImport, /createLeadForVenue\(\s*venueId,\s*row\s*\)/);
  });

  it("insertLead threads isHistoricalImport into the atomic create payload", () => {
    assert.match(leadsRepo, /isHistoricalImport:\s*historicalImport/);
    assert.match(leadsRepo, /leads\.is_historical_import/);
  });

  it("venue new-inquiry trigger returns early when is_historical_import is set", () => {
    assert.match(notifyTrigger, /if NEW\.is_historical_import then[\s\S]*?return NEW;/);
    assert.match(notifyTrigger, /create_venue_notification/);
  });

  it("pipeline shouldAutomate requires !historicalImport before sequences", () => {
    assert.match(
      pipeline,
      /const shouldAutomate\s*=\s*[\s\S]*?!opts\.historicalImport[\s\S]*?trustTier/,
    );
  });
});

describe("ingestLead — quiet vs live automation boundary", () => {
  it("historicalImport true never queries message_sequences", async () => {
    const { client, tableCalls } = mockClient();
    const outcome = await ingestLead(baseOptions(client, true));
    assert.equal(outcome.ok, true);
    assert.equal(tableCalls["message_sequences"] ?? 0, 0);
  });

  it("non-historical import trust tier still enrolls via message_sequences", async () => {
    const { client, tableCalls } = mockClient();
    const outcome = await ingestLead(baseOptions(client, false));
    assert.equal(outcome.ok, true);
    assert.ok((tableCalls["message_sequences"] ?? 0) > 0);
  });

  it("manual non-historical create remains eligible for automation", async () => {
    const { client, tableCalls } = mockClient();
    const opts = baseOptions(client, false);
    opts.trustTier = "manual";
    opts.source = "other";
    const outcome = await ingestLead(opts);
    assert.equal(outcome.ok, true);
    assert.ok((tableCalls["message_sequences"] ?? 0) > 0);
  });
});
