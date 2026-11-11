/**
 * Migration excellence wiring: past-date clients create historical Events;
 * packages accept composition lines.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { isPastEventDate } from "@/lib/migration/historical-record";
import { parsePackageIncludedItems } from "@/lib/import/package-items";

const venueImport = readFileSync(resolve("app/(app)/settings/import/actions.ts"), "utf8");
const adminImport = readFileSync(resolve("app/admin/onboarding/import-actions.ts"), "utf8");
const migrationService = readFileSync(resolve("lib/migration/service.ts"), "utf8");
const genericCsv = readFileSync(resolve("lib/migration/sources/generic-csv.ts"), "utf8");

describe("client → Event migration contract", () => {
  it("treats past dates as historical Event creates on Import Data and MC", () => {
    assert.equal(isPastEventDate("2020-01-01", "2026-10-20"), true);
    assert.equal(isPastEventDate("2027-06-15", "2026-10-20"), false);
    assert.match(venueImport, /isPastEventDate\(spaced\.input\.eventDate\)/);
    assert.match(venueImport, /createClient_\([\s\S]*true,\s*asHistorical/);
    assert.match(adminImport, /createClientForVenue\(venueId, input, true, asHistorical\)/);
    assert.match(migrationService, /const asHistorical = isPastEventDate\(n\.eventDate\)/);
  });
});

describe("package composition migration contract", () => {
  it("wires included items through Import Data, admin, and Migration Center", () => {
    assert.match(venueImport, /addPackageItems\(/);
    assert.match(adminImport, /addPackageItemsForVenue\(/);
    assert.match(migrationService, /addPackageItemsForVenue|addPackageItems/);
    assert.match(genericCsv, /parsePackageIncludedItems|includedItems/);
    const parsed = parsePackageIncludedItems("A|2|ea");
    assert.equal(parsed.ok, true);
  });
});
