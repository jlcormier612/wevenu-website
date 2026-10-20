import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("guest_list migration commit uses service-role writes", () => {
  it("commitOneRecord guest_list path calls createAdminClient before commitOperationalGuest", () => {
    const src = readFileSync("lib/migration/service.ts", "utf8");
    const start = src.indexOf('if (entityType === "guest_list")');
    assert.ok(start > 0, "guest_list commit branch missing");
    const end = src.indexOf('if (entityType === "event_vendor_assignment")', start);
    const body = src.slice(start, end);
    assert.match(body, /createAdminClient\s*\(/);
    assert.match(body, /commitOperationalGuest\s*\(\s*writeClient/);
    // Must not commit guests with the venue JWT client (RLS SELECT-only).
    assert.doesNotMatch(body, /commitOperationalGuest\s*\(\s*client\s*,/);
  });

  it("unexpected commit errors surface Postgrest message fields", () => {
    const src = readFileSync("lib/migration/service.ts", "utf8");
    const start = src.indexOf("function unexpectedCommitErrorMessage");
    const end = src.indexOf("export async function commitSession", start);
    const body = src.slice(start, end);
    assert.match(body, /"message" in err/);
    assert.doesNotMatch(body, /String\(err\)\s*;\s*\n\s*return/);
  });
});
