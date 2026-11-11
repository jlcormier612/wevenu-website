import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

import {
  VENDOR_PRIVATE_NOTES_HINT,
  VENDOR_PRIVATE_NOTES_LABEL,
} from "@/lib/notes/vendor-private-notes-copy";
import { INTERNAL_NOTES_PRIVACY_HINT } from "@/lib/notes/internal-notes-copy";

const ROOT = join(process.cwd());

describe("vendor-private notes locked copy", () => {
  it("uses vendor-team privacy language, not venue Internal Notes hint", () => {
    assert.equal(VENDOR_PRIVATE_NOTES_LABEL, "Internal notes");
    assert.equal(
      VENDOR_PRIVATE_NOTES_HINT,
      "Private to your vendor team — never visible to the venue or client.",
    );
    assert.notEqual(VENDOR_PRIVATE_NOTES_HINT, INTERNAL_NOTES_PRIVACY_HINT);
    assert.match(VENDOR_PRIVATE_NOTES_HINT, /venue/);
    assert.match(VENDOR_PRIVATE_NOTES_HINT, /client/);
  });

  it("vendor event Notes tab uses locked vendor-private copy", () => {
    const src = readFileSync(
      join(ROOT, "components/vendor-app/vendor-event-workspace.tsx"),
      "utf8",
    );
    assert.match(src, /VENDOR_PRIVATE_NOTES_LABEL/);
    assert.match(src, /VENDOR_PRIVATE_NOTES_HINT/);
    assert.doesNotMatch(src, /Private notes visible only to you/);
    assert.doesNotMatch(src, /INTERNAL_NOTES_PRIVACY_HINT/);
  });

  it("vendor inquiry surfaces use locked vendor-private copy", () => {
    for (const rel of [
      "components/vendor-app/vendor-inquiry-detail.tsx",
      "components/vendor-app/vendor-inquiry-pipeline.tsx",
    ]) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      assert.match(src, /VENDOR_PRIVATE_NOTES_LABEL/);
      assert.match(src, /VENDOR_PRIVATE_NOTES_HINT/);
    }
  });

  it("update_vendor_assignment_notes only writes for the authenticated vendor", () => {
    const sql = readFileSync(
      join(ROOT, "supabase/migrations/20261124000000_sprint2_vendor_certification_fixes.sql"),
      "utf8",
    );
    assert.match(sql, /create or replace function public\.update_vendor_assignment_notes/);
    assert.match(sql, /current_user_vendor_id\(\)/);
    assert.match(sql, /set internal_notes = nullif\(p_notes, ''\)/);
    assert.match(sql, /where id = p_assignment_id and vendor_id = v_vendor_id/);
  });

  it("column lock revokes authenticated select/update on internal_notes", () => {
    const sql = readFileSync(
      join(ROOT, "supabase/migrations/20261404000000_vendor_assignment_internal_notes_column_lock.sql"),
      "utf8",
    );
    assert.match(sql, /revoke select \(internal_notes\), update \(internal_notes\)/);
    assert.match(sql, /from authenticated/);
  });

  it("venue assignment repository never selects internal_notes", () => {
    const src = readFileSync(join(ROOT, "lib/vendors/repository.ts"), "utf8");
    assert.match(src, /EVA_VENUE_SELECT/);
    assert.doesNotMatch(src, /EVA_VENUE_SELECT[\s\S]*internal_notes/);
    assert.doesNotMatch(
      src,
      /\.from\("event_vendor_assignments"\)[\s\S]{0,120}\.select\("\*/,
    );
  });
});
