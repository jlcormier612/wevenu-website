import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { parsePublicLeadRpcSuccess } from "@/lib/lead-intake/public-lead-rpc";

describe("parsePublicLeadRpcSuccess", () => {
  it("reads relationshipId from create_public_lead success payload", () => {
    const parsed = parsePublicLeadRpcSuccess({
      ok: true,
      lead_id: "lead-1",
      relationshipId: "rel-1",
      isReturningRelationship: false,
    });
    assert.deepEqual(parsed, {
      leadId: "lead-1",
      relationshipId: "rel-1",
      isReturningRelationship: false,
    });
  });

  it("rejects success payloads that omit relationshipId (pre-fix shape)", () => {
    assert.equal(
      parsePublicLeadRpcSuccess({ ok: true, lead_id: "lead-1" }),
      null,
    );
  });

  it("rejects failed payloads", () => {
    assert.equal(
      parsePublicLeadRpcSuccess({ ok: false, error: "event_type_required" }),
      null,
    );
  });
});

describe("create_public_lead returns relationship for public inquire", () => {
  const sql = readFileSync(
    resolve("supabase/migrations/20261341000000_create_public_lead_return_relationship.sql"),
    "utf8",
  );

  it("propagates relationshipId and isReturningRelationship from ingest_lead", () => {
    assert.match(sql, /'relationshipId', v_result ->> 'relationshipId'/);
    assert.match(sql, /'isReturningRelationship'/);
    assert.match(sql, /'lead_id', v_result ->> 'leadId'/);
  });

  it("inquire route prefers RPC relationship fields and falls back to admin, not anon", () => {
    const route = readFileSync(resolve("app/api/public/inquire/route.ts"), "utf8");
    assert.match(route, /parsePublicLeadRpcSuccess/);
    assert.match(route, /createAdminClient/);
    assert.doesNotMatch(
      route,
      /await supabase\.from\("leads"\)\.select\("relationship_id"\)/,
    );
  });
});
