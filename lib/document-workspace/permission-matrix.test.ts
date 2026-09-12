import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { permission } from "@/lib/document-workspace/permission-matrix";

const root = process.cwd();

describe("Documents permission matrix", () => {
  it("never allows cross-venue access", () => {
    for (const actor of ["owner", "manager", "coordinator", "couple", "vendor"] as const) {
      assert.equal(permission(actor, "event_document", "cross_venue"), false);
      assert.equal(permission(actor, "contract_artifact", "cross_venue"), false);
    }
  });

  it("protects finalized contract artifacts from generic replace/delete", () => {
    assert.equal(permission("owner", "contract_artifact", "replace"), false);
    assert.equal(permission("owner", "contract_artifact", "delete"), false);
    assert.equal(permission("coordinator", "contract_artifact", "edit_metadata"), false);
    assert.equal(permission("couple", "contract_artifact", "delete"), false);
  });

  it("couple sees shared files only; cannot create venue documents", () => {
    assert.equal(permission("couple", "event_document", "read"), "when_shared");
    assert.equal(permission("couple", "event_document", "create"), false);
    assert.equal(permission("couple", "lead_document", "read"), false);
    assert.equal(permission("couple", "couple_upload", "create"), true);
  });

  it("vendor sees only shared event documents and own library", () => {
    assert.equal(permission("vendor", "event_document", "read"), "when_shared");
    assert.equal(permission("vendor", "event_document", "cross_event"), "own_event");
    assert.equal(permission("vendor", "questionnaire", "read"), false);
    assert.equal(permission("vendor", "vendor_document", "create"), true);
  });

  it("venue staff share one venue-scoped documents RLS policy", () => {
    const team = readFileSync(join(root, "supabase/migrations/20260708120000_sprint107_team_collaboration.sql"), "utf8");
    assert.match(team, /create policy documents_all on public\.documents/);
    assert.match(team, /venue_id = public\.current_user_venue_id\(\)/);
    const storage = readFileSync(join(root, "supabase/migrations/20261370000000_documents_workspace_completion.sql"), "utf8");
    assert.match(storage, /set public = false/);
    assert.match(storage, /current_user_venue_id\(\)::text/);
    assert.doesNotMatch(storage, /for select to authenticated, anon/);
  });

  it("portal couple file route requires token and visibility check", () => {
    const route = readFileSync(join(root, "app/api/portal/documents/[id]/file/route.ts"), "utf8");
    assert.match(route, /_resolve_portal_ids/);
    assert.match(route, /kind: "couple"/);
    assert.match(route, /createDocumentsSignedUrl/);
  });
});
