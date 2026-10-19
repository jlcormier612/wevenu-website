/**
 * Same Resend email_id must not create a second lead, including when the
 * attempt insert loses the unique-index race before the first row is accepted.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { ingestLead } from "@/lib/lead-intake/pipeline";
import type { IngestLeadOptions } from "@/lib/lead-intake/types";

type Lookup = { data: Record<string, unknown> | null; error: null };

function client(opts: {
  insert: { data: { id: string } | null; error: { code?: string; message: string } | null };
  lookups: Lookup[];
}) {
  let lookup = 0;
  function chain(): Record<string, unknown> {
    const c: Record<string, unknown> = {};
    const self = () => c;
    c.select = self;
    c.insert = () => ({ select: () => ({ single: async () => opts.insert }) });
    c.update = self;
    c.eq = self;
    c.gte = self;
    c.lte = self;
    c.order = self;
    c.limit = self;
    c.maybeSingle = async () => opts.lookups[lookup++] ?? { data: null, error: null };
    c.single = async () => opts.insert;
    c.then = (resolve: (value: { data: unknown[]; error: null }) => void) => resolve({ data: [], error: null });
    return c;
  }
  return { from: () => chain() };
}

const input = {
  firstName: "Jamie",
  lastName: "Rivera",
  email: "jamie.reforward@mail.hellotocheers.test",
  inquiryMessage: "We would like to visit.",
  confidenceScore: null,
};

function run(supabase: unknown, create: IngestLeadOptions["create"]) {
  return ingestLead({
    supabase: supabase as IngestLeadOptions["supabase"],
    venueId: "venue-1",
    source: "email_parsed_generic",
    trustTier: "email_parsed",
    rawPayload: {},
    externalRef: "resend-email-1",
    input,
    create,
  });
}

describe("email intake replay", () => {
  it("returns the original lead when the same email_id is already accepted", async () => {
    let created = 0;
    const outcome = await run(
      client({
        insert: { data: { id: "should-not-insert" }, error: null },
        lookups: [{ data: { id: "attempt-1", lead_id: "lead-1", relationship_id: "rel-1" }, error: null }],
      }),
      async () => {
        created += 1;
        return { ok: true, leadId: "lead-new", relationshipId: "rel-new", isReturningRelationship: false };
      },
    );
    assert.equal(outcome.ok, true);
    if (outcome.ok) assert.equal(outcome.leadId, "lead-1");
    assert.equal(created, 0);
  });

  it("does not create a lead when the attempt insert loses a race to an in-progress row", async () => {
    let created = 0;
    const outcome = await run(
      client({
        insert: { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint lead_intake_attempts_external_ref" } },
        lookups: [
          { data: null, error: null },
          { data: { id: "attempt-1", status: "received", lead_id: null, relationship_id: null }, error: null },
        ],
      }),
      async () => {
        created += 1;
        return { ok: true, leadId: "lead-new", relationshipId: "rel-new", isReturningRelationship: false };
      },
    );
    assert.equal(outcome.ok, false);
    assert.equal(created, 0);
  });

  it("retries lead creation when the earlier attempt failed before a lead existed", async () => {
    let created = 0;
    const outcome = await run(
      client({
        insert: { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint lead_intake_attempts_external_ref" } },
        lookups: [
          { data: null, error: null },
          { data: { id: "attempt-1", status: "error", lead_id: null, relationship_id: null }, error: null },
        ],
      }),
      async () => {
        created += 1;
        return { ok: true, leadId: "lead-retry", relationshipId: "rel-retry", isReturningRelationship: false };
      },
    );
    assert.equal(outcome.ok, true);
    if (outcome.ok) assert.equal(outcome.leadId, "lead-retry");
    assert.equal(created, 1);
  });
});

describe("re-forward review does not change attribution or intake health", () => {
  it("keeps acquisition writes and intake-failure statuses out of this signal", () => {
    const pipeline = readFileSync(resolve("lib/lead-intake/pipeline.ts"), "utf8");
    const health = readFileSync(resolve("lib/lead-intake/email-intake-health.ts"), "utf8");
    const sequences = readFileSync(resolve("lib/message-sequences/service.ts"), "utf8");
    const review = readFileSync(resolve("lib/leads/duplicate-review.ts"), "utf8");
    assert.match(pipeline, /trustTier === "email_parsed" \? normalized\.inquiryMessage/);
    assert.doesNotMatch(pipeline, /acquisition_source/);
    assert.doesNotMatch(health, /inquiry_text/);
    assert.match(sequences, /hasActiveEnrollment/);
    assert.match(review, /kept_separate/);
    assert.doesNotMatch(review, /\.from\("leads"\)[\s\S]{0,80}\.delete\(/);
  });
});
