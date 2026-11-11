import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { genericCsvAdapter } from "@/lib/migration/sources/generic-csv";
import {
  isVenueGuestListImportRemoved,
  VENUE_GUEST_LIST_IMPORT_REMOVED_MESSAGE,
} from "@/lib/migration/venue-guest-list-import";

describe("venue Migration Center guest_list import removed", () => {
  it("exports a clear rejection message and entity guard", () => {
    assert.equal(isVenueGuestListImportRemoved("guest_list"), true);
    assert.equal(isVenueGuestListImportRemoved("client"), false);
    assert.match(VENUE_GUEST_LIST_IMPORT_REMOVED_MESSAGE, /cannot be imported/i);
    assert.match(VENUE_GUEST_LIST_IMPORT_REMOVED_MESSAGE, /portal/i);
  });

  it("venue-facing COMMITTABLE_ENTITIES no longer offers guest_list", () => {
    const src = readFileSync("components/settings/migration-center.tsx", "utf8");
    const start = src.indexOf("const COMMITTABLE_ENTITIES");
    const end = src.indexOf("];", start);
    assert.ok(start > 0 && end > start, "COMMITTABLE_ENTITIES missing");
    const block = src.slice(start, end + 2);
    assert.doesNotMatch(block, /"guest_list"/);
    assert.match(block, /"client"/);
    assert.match(block, /"event"/);
  });

  it("server COMMITTABLE_ENTITY_TYPES no longer includes guest_list", () => {
    const src = readFileSync("lib/migration/service.ts", "utf8");
    const start = src.indexOf("const COMMITTABLE_ENTITY_TYPES");
    const end = src.indexOf("];", start);
    assert.ok(start > 0 && end > start, "COMMITTABLE_ENTITY_TYPES missing");
    const block = src.slice(start, end + 2);
    assert.doesNotMatch(block, /"guest_list"/);
  });

  it("addRowsToOwnSession rejects guest_list before any write", () => {
    const src = readFileSync("lib/migration/service.ts", "utf8");
    const start = src.indexOf("export async function addRowsToOwnSession");
    const end = src.indexOf("export async function runDedupeForOwnSession", start);
    const body = src.slice(start, end);
    assert.match(body, /isVenueGuestListImportRemoved\s*\(\s*entityType\s*\)/);
    assert.match(body, /VENUE_GUEST_LIST_IMPORT_REMOVED_MESSAGE/);
    const guardIdx = body.indexOf("isVenueGuestListImportRemoved");
    const addRowsIdx = body.indexOf("await addRows(");
    assert.ok(guardIdx > 0 && addRowsIdx > guardIdx, "guest_list guard must run before addRows");
  });

  it("addRows throws for guest_list so forged callers cannot insert migration_records", () => {
    const src = readFileSync("lib/migration/service.ts", "utf8");
    const start = src.indexOf("export async function addRows(");
    const end = src.indexOf("export function inBatchDuplicateKey", start) > 0
      ? src.indexOf("function inBatchDuplicateKey", start)
      : src.indexOf("/**\n * In-batch", start);
    const body = src.slice(start, end > start ? end : start + 800);
    assert.match(body, /isVenueGuestListImportRemoved\s*\(\s*entityType\s*\)/);
    assert.match(body, /throw new Error\s*\(\s*VENUE_GUEST_LIST_IMPORT_REMOVED_MESSAGE\s*\)/);
    const guardIdx = body.indexOf("isVenueGuestListImportRemoved");
    const insertIdx = body.indexOf("insertRecords");
    assert.ok(guardIdx > 0 && insertIdx > guardIdx, "guest_list guard must run before insertRecords");
  });

  it("commitOneRecord rejects guest_list without admin write or guest table DML", () => {
    const src = readFileSync("lib/migration/service.ts", "utf8");
    const start = src.indexOf('if (entityType === "guest_list")');
    assert.ok(start > 0, "guest_list commit branch missing");
    const end = src.indexOf('if (entityType === "event_vendor_assignment")', start);
    const body = src.slice(start, end);
    assert.match(body, /VENUE_GUEST_LIST_IMPORT_REMOVED_MESSAGE/);
    assert.match(body, /ok:\s*false/);
    assert.doesNotMatch(body, /createAdminClient\s*\(/);
    assert.doesNotMatch(body, /commitOperationalGuest\s*\(/);
    assert.doesNotMatch(body, /\.from\s*\(\s*["']couple_guests["']\s*\)/);
    assert.doesNotMatch(body, /visibility_to_venue\s*:/);
  });

  it("generic-csv normalize rejects guest_list without producing a payload", () => {
    const result = genericCsvAdapter.normalizeRow(
      {
        firstName: "Ada",
        lastName: "Guest",
        clientEmail: "couple@example.com",
        eventDate: "2099-06-01",
      },
      "guest_list",
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, VENUE_GUEST_LIST_IMPORT_REMOVED_MESSAGE);
    }
  });

  it("service no longer imports operational-guest for venue MC commits", () => {
    const src = readFileSync("lib/migration/service.ts", "utf8");
    assert.doesNotMatch(src, /from\s+["']@\/lib\/migration\/operational-guest["']/);
    assert.doesNotMatch(src, /commitOperationalGuest\s*\(/);
  });
});
