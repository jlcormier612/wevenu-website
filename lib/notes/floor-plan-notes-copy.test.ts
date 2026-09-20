import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

import {
  FLOOR_PLAN_NOTES_LABEL,
  FLOOR_PLAN_NOTES_SHARE_HINT,
} from "@/lib/notes/floor-plan-notes-copy";
import { INTERNAL_NOTES_LABEL, INTERNAL_NOTES_PRIVACY_HINT } from "@/lib/notes/internal-notes-copy";

const ROOT = join(process.cwd());

describe("floor-plan notes share warning", () => {
  it("is not labeled as venue Internal notes", () => {
    assert.equal(FLOOR_PLAN_NOTES_LABEL, "Notes");
    assert.notEqual(FLOOR_PLAN_NOTES_LABEL, INTERNAL_NOTES_LABEL);
    assert.equal(
      FLOOR_PLAN_NOTES_SHARE_HINT,
      "Notes on a shared floor plan may be visible to the client.",
    );
    assert.notEqual(FLOOR_PLAN_NOTES_SHARE_HINT, INTERNAL_NOTES_PRIVACY_HINT);
    assert.doesNotMatch(FLOOR_PLAN_NOTES_SHARE_HINT, /never team/i);
    assert.doesNotMatch(FLOOR_PLAN_NOTES_SHARE_HINT, /never Internal/i);
  });

  it("venue floor-plan editor surfaces the share warning", () => {
    const src = readFileSync(
      join(ROOT, "components/floor-plan/floor-plan-editor.tsx"),
      "utf8",
    );
    assert.match(src, /FLOOR_PLAN_NOTES_SHARE_HINT/);
    assert.match(src, /FLOOR_PLAN_NOTES_LABEL/);
    assert.doesNotMatch(src, /INTERNAL_NOTES_PRIVACY_HINT/);
    assert.doesNotMatch(src, /Setup notes for your team/);
  });

  it("portal floor-plan RPC includes plan and object notes when shared", () => {
    const sql = readFileSync(
      join(ROOT, "supabase/migrations/20261250000000_floor_plan_phase1_couple_share_and_operational.sql"),
      "utf8",
    );
    assert.match(sql, /create or replace function public\.get_portal_floor_plan/);
    assert.match(sql, /fp\.shared_with_couple = true/);
    assert.match(sql, /'notes', v_plan\.notes/);
    assert.match(sql, /'notes', o\.notes/);
  });
});
