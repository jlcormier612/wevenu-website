import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { VENUE_GUEST_LIST_IMPORT_REMOVED_MESSAGE } from "@/lib/migration/venue-guest-list-import";

/**
 * Formerly asserted that venue MC guest_list commits used createAdminClient.
 * Product decision: venue Migration Center must not import guest lists at all.
 * Admin-write path is retired; rejection must not touch couple_guests.
 */
describe("guest_list venue Migration Center import removed (auth boundary)", () => {
  it("commitOneRecord guest_list path rejects without service-role guest writes", () => {
    const src = readFileSync("lib/migration/service.ts", "utf8");
    const start = src.indexOf('if (entityType === "guest_list")');
    assert.ok(start > 0, "guest_list commit branch missing");
    const end = src.indexOf('if (entityType === "event_vendor_assignment")', start);
    const body = src.slice(start, end);
    assert.match(body, /ok:\s*false/);
    assert.ok(
      body.includes("VENUE_GUEST_LIST_IMPORT_REMOVED_MESSAGE")
        || body.includes(VENUE_GUEST_LIST_IMPORT_REMOVED_MESSAGE),
      "rejection must use the shared removed-import message",
    );
    assert.doesNotMatch(body, /createAdminClient\s*\(/);
    assert.doesNotMatch(body, /commitOperationalGuest\s*\(/);
  });

  it("unexpected commit errors still surface Postgrest message fields", () => {
    const src = readFileSync("lib/migration/service.ts", "utf8");
    const start = src.indexOf("function unexpectedCommitErrorMessage");
    const end = src.indexOf("export async function commitSession", start);
    const body = src.slice(start, end);
    assert.match(body, /"message" in err/);
    assert.doesNotMatch(body, /String\(err\)\s*;\s*\n\s*return/);
  });
});
