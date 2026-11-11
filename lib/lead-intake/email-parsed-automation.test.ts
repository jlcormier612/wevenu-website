/**
 * Email-parsed intake must not enroll automations when confidence was never
 * established, and inbound email retries must reuse the provider email id.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
    c.then = (resolve: (value: { data: unknown[]; error: null }) => void) => resolve({ data: [], error: null });
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
  eventDate: "2026-11-02",
};

function options(client: unknown, confidenceScore: number | null): IngestLeadOptions {
  return {
    supabase: client as IngestLeadOptions["supabase"],
    venueId: "venue-1",
    source: "email_parsed_generic",
    trustTier: "email_parsed",
    rawPayload: {},
    input: { ...RAW, confidenceScore },
    create: async () => ({ ok: true, leadId: "lead-1", relationshipId: "rel-1", isReturningRelationship: false }),
  };
}

describe("email-parsed automation eligibility", () => {
  it("does not enroll when confidence was not established", async () => {
    const { client, tableCalls } = mockClient();
    const outcome = await ingestLead(options(client, null));
    assert.equal(outcome.ok, true);
    assert.equal(tableCalls.message_sequences ?? 0, 0);
  });

  it("does not enroll a low-confidence parse", async () => {
    const { client, tableCalls } = mockClient();
    const outcome = await ingestLead(options(client, 49));
    assert.equal(outcome.ok, true);
    assert.equal(tableCalls.message_sequences ?? 0, 0);
  });

  it("enrolls when confidence is established", async () => {
    const { client, tableCalls } = mockClient();
    const outcome = await ingestLead(options(client, 80));
    assert.equal(outcome.ok, true);
    assert.ok((tableCalls.message_sequences ?? 0) > 0);
  });

  it("passes the Resend email id as the intake external reference", () => {
    const route = readFileSync(resolve("app/api/leads/email-intake/route.ts"), "utf8");
    assert.match(route, /externalRef:\s*email_id/);
    const extract = readFileSync(resolve("lib/lead-intake/email-extract.ts"), "utf8");
    assert.match(extract, /confidence === null \? null/);
    assert.doesNotMatch(extract, /confidence === null \? 50/);
  });
});
