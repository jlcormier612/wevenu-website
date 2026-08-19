import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("uploads bucket venue-scoped write policies", () => {
  const original = readFileSync(
    join(process.cwd(), "supabase/migrations/20260627020000_uploads_bucket.sql"),
    "utf8",
  );
  const fix = readFileSync(
    join(process.cwd(), "supabase/migrations/20261299000000_uploads_bucket_venue_scoped_write.sql"),
    "utf8",
  );

  it("the original bucket granted insert/delete but not update (upsert replace)", () => {
    assert.match(original, /uploads_insert/);
    assert.match(original, /uploads_delete/);
    assert.doesNotMatch(original, /uploads_update/);
  });

  it("adds an authenticated UPDATE policy so upsert can replace an existing logo", () => {
    assert.match(fix, /create policy "uploads_update" on storage\.objects/);
    assert.match(fix, /for update/);
    assert.match(fix, /to authenticated/);
  });

  it("scopes writes to the caller's venue folder and does not take a venue_id argument", () => {
    assert.match(fix, /current_user_venue_id\(\)::text/);
    assert.match(fix, /\(storage\.foldername\(name\)\)\[1\]/);
    assert.doesNotMatch(fix, /p_venue_id/);
  });

  it("does not grant write to anon, coordinator, or staff", () => {
    const statements = fix.split("\n").filter((line) => !line.trim().startsWith("--")).join("\n");
    assert.match(statements, /current_user_role\(\) in \('owner', 'manager'\)/);
    assert.doesNotMatch(statements, /\bto anon\b/);
    assert.doesNotMatch(statements, /\bto public\b/);
    assert.doesNotMatch(statements, /service_role/);
  });
});
