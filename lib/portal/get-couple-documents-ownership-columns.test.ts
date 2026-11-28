/**
 * Batch 2C — Documents ownership columns required by get_couple_documents.
 * Source contracts: tip migration exists; shadowed vendor_documents collision documented.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const ROOT = resolve(".");

describe("documents uploaded_by ownership columns (Batch 2C Defect A)", () => {
  it("ships an idempotent tip migration that adds uploaded_by_type/id columns", () => {
    const path = resolve(
      ROOT,
      "supabase/migrations/20270328120000_documents_uploaded_by_ownership_columns.sql",
    );
    const sql = readFileSync(path, "utf8");
    assert.match(sql, /add column if not exists uploaded_by_type/);
    assert.match(sql, /add column if not exists uploaded_by_id/);
    assert.match(sql, /add column if not exists source_library_document_id/);
    assert.match(sql, /documents_uploaded_by_vendor/);
    assert.match(sql, /20261177000000_vendor_documents/);
    assert.match(sql, /lifecycle_engine_service_role_grants/);
    assert.doesNotMatch(sql, /security definer[\s\S]*get_couple_documents/i);
  });

  it("documents the duplicate 20261177000000 collision still present in repo history", () => {
    const files = readdirSync(resolve(ROOT, "supabase/migrations")).filter((f) =>
      f.startsWith("20261177000000_"),
    );
    assert.ok(
      files.includes("20261177000000_lifecycle_engine_service_role_grants.sql"),
      "lifecycle grants tip present",
    );
    assert.ok(
      files.includes("20261177000000_vendor_documents.sql"),
      "shadowed vendor_documents file still in history (not reapplied under that stamp)",
    );
  });
});
