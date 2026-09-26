import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { foreignHoldCount } from "@/lib/availability/holds";

const repo = readFileSync(resolve("lib/availability/repository.ts"), "utf8");
const leadDetail = readFileSync(resolve("components/leads/lead-detail.tsx"), "utf8");
const sql = readFileSync(
  resolve("supabase/migrations/20261407400000_hold_same_owner_exclusion.sql"),
  "utf8",
);
const publicSql = readFileSync(
  resolve("supabase/migrations/20261403200000_hold_blocks_public_availability.sql"),
  "utf8",
);

describe("same-owner hold exclusion", () => {
  it("drops only the checking lead's holds", () => {
    const rows = [
      { lead_id: "lead-a" },
      { lead_id: "lead-b" },
      { lead_id: null },
    ];
    assert.equal(foreignHoldCount(rows, "lead-a"), 2);
    assert.equal(foreignHoldCount(rows, "lead-b"), 2);
    assert.equal(foreignHoldCount(rows, null), 3);
    assert.equal(foreignHoldCount(rows), 3);
    assert.equal(foreignHoldCount([{ lead_id: "lead-a" }], "lead-a"), 0);
  });

  it("lead detail passes the lead id into availability", () => {
    assert.match(leadDetail, /excludeLeadId=\{lead\.id\}/);
    assert.match(repo, /foreignHoldCount\(/);
    assert.match(repo, /excludeLeadId/);
  });

  it("booked-event SQL excludes the event client's originating lead", () => {
    assert.match(sql, /c\.lead_id = h\.lead_id/);
    assert.match(sql, /hold_blocks_availability/);
  });

  it("public availability still blocks any active hold", () => {
    const fn = publicSql.slice(publicSql.indexOf("function public._is_event_date_available"));
    assert.match(fn, /date_holds/);
    assert.doesNotMatch(fn, /c\.lead_id = h\.lead_id/);
  });
});
