import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const MIGRATION = "supabase/migrations/20261410700000_relationship_archive.sql";
const ARCHIVE = "lib/relationships/archive.ts";
const LEADS_REPO = "lib/leads/repository.ts";
const CLIENTS_REPO = "lib/clients/repository.ts";
const DASHBOARD = "lib/dashboard/service.ts";
const ACTIONS = "app/(app)/leads/[id]/actions.ts";
const DETAIL = "components/leads/lead-detail.tsx";

describe("relationship Archive contract", () => {
  it("adds archived_at authority on venue_customer_relationships", () => {
    const sql = readFileSync(resolve(MIGRATION), "utf8");
    assert.match(sql, /venue_customer_relationships/);
    assert.match(sql, /archived_at timestamptz/);
    assert.match(sql, /archived_by uuid/);
    assert.match(sql, /where archived_at is null/);
  });

  it("archive and restore update relationship authority without deleting children", () => {
    const src = readFileSync(resolve(ARCHIVE), "utf8");
    assert.match(src, /export async function archiveRelationship/);
    assert.match(src, /export async function restoreRelationship/);
    assert.match(src, /archived_at: new Date\(\)\.toISOString\(\)/);
    assert.match(src, /archived_at: null/);
    assert.doesNotMatch(src, /\.delete\(/);
    assert.doesNotMatch(src, /deleteLeadRecord|deleteClientRecord/);
  });

  it("active lead and client lists exclude archived relationships", () => {
    const leads = readFileSync(resolve(LEADS_REPO), "utf8");
    const clients = readFileSync(resolve(CLIENTS_REPO), "utf8");
    assert.match(leads, /includeArchived/);
    assert.match(leads, /archived_at/);
    assert.match(clients, /includeArchived/);
    assert.match(clients, /archived_at/);
  });

  it("dashboard focus skips archived relationships", () => {
    const dash = readFileSync(resolve(DASHBOARD), "utf8");
    assert.match(dash, /archivedRelationshipIds/);
    assert.match(dash, /relationship_id/);
  });

  it("lead workspace exposes Archive as distinct from Delete", () => {
    const actions = readFileSync(resolve(ACTIONS), "utf8");
    const detail = readFileSync(resolve(DETAIL), "utf8");
    assert.match(actions, /archiveLeadRelationshipAction/);
    assert.match(actions, /restoreLeadRelationshipAction/);
    assert.match(detail, /Archive/);
    assert.match(detail, /archiveLeadRelationshipAction/);
    assert.match(detail, /DeleteRecordButton/);
  });
});
