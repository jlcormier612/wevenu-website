import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const migration = readFileSync(
  join(root, "supabase/migrations/20261370000000_documents_workspace_completion.sql"),
  "utf8",
);

describe("get_venue_documents workspace union", () => {
  it("unions generic documents, contracts, invoices, floor plans, questionnaires, and event orders", () => {
    assert.match(migration, /'docType',\s+'document'/);
    assert.match(migration, /'docType',\s+'contract'/);
    assert.match(migration, /'docType',\s+'invoice'/);
    assert.match(migration, /'docType',\s+'floor_plan'/);
    assert.match(migration, /'docType',\s+'questionnaire'/);
    assert.match(migration, /'docType',\s+'event_order'/);
  });

  it("does not dump inbox attachments, media, or templates into the union", () => {
    assert.doesNotMatch(migration, /conversation_message_attachments/);
    assert.doesNotMatch(migration, /client-media/);
    assert.doesNotMatch(migration, /from public\.questionnaire_templates/);
  });

  it("gives questionnaires a relationship name and event orders a producer representation", () => {
    assert.match(migration, /from public\.event_questionnaires q/);
    assert.match(migration, /join public\.clients cl on cl\.id = e\.client_id/);
    assert.match(migration, /from public\.event_orders eo/);
    assert.match(migration, /eo\.shared_at is not null/);
  });

  it("does not put a public contract PDF URL on the contract row", () => {
    const contractBlock = migration.slice(
      migration.indexOf("'docType',         'contract'"),
      migration.indexOf("'docType',         'invoice'"),
    );
    assert.match(contractBlock, /'fileUrl',\s+null/);
  });

  it("creates append-only document_file_versions and replace_document_file", () => {
    assert.match(migration, /create table if not exists public\.document_file_versions/);
    assert.match(migration, /create or replace function public\.replace_document_file/);
    assert.match(migration, /if v_doc\.storage_path = p_storage_path then/);
  });

  it("makes the documents bucket private and keeps the sandbox verifier aligned", () => {
    assert.match(migration, /update storage\.buckets\s+set public = false\s+where id = 'documents'/);
    const verify = readFileSync(join(root, "scripts/verify-sandbox-database.sh"), "utf8");
    assert.match(verify, /\["documents"\]="f"/);
    assert.doesNotMatch(verify, /\["documents"\]="t"/);
  });
});
