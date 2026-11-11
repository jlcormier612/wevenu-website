/**
 * Rehearsal Dinner date: Space Preferences no longer show a standalone Date
 * field; linked holds sync preference.scheduled_date for contract merge.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

const PREFS_UI = readFileSync(resolve("components/leads/space-preference-fields.tsx"), "utf8");
const REPO = readFileSync(resolve("lib/availability/repository.ts"), "utf8");
const CONTRACT = readFileSync(resolve("lib/contracts/service.ts"), "utf8");
const BOOK = readFileSync(resolve("lib/booking-journey/book-client.ts"), "utf8");

describe("Rehearsal date authority via holds", () => {
  it("Space Preferences UI no longer renders a Rehearsal Dinner Date input", () => {
    assert.doesNotMatch(PREFS_UI, /space-pref-scheduled-date-rehearsal_dinner/);
    assert.doesNotMatch(PREFS_UI, /pref-date-rehearsal_dinner/);
    // Rehearsal dinner checkbox/space control remains.
    assert.match(PREFS_UI, /space-pref-row-\$\{use\.key\}|rehearsal_dinner/);
  });

  it("insertHold and updateHold sync linked preference.scheduled_date from hold start", () => {
    assert.match(REPO, /syncLinkedPreferenceScheduledDate/);
    const insertFn = REPO.slice(REPO.indexOf("export async function insertHold"));
    assert.match(insertFn, /syncLinkedPreferenceScheduledDate/);
    const updateFn = REPO.slice(REPO.indexOf("export async function updateHold"));
    assert.match(updateFn, /syncLinkedPreferenceScheduledDate/);
  });

  it("contract merge falls back to linked active hold when preference date blank", () => {
    assert.match(CONTRACT, /holdDateByPreferenceId/);
    assert.match(CONTRACT, /date_holds/);
    assert.match(CONTRACT, /rehearsal_dinner/);
  });

  it("book-client still copies preference scheduled_date onto client.rehearsal_date", () => {
    assert.match(BOOK, /scheduled_date/);
    assert.match(BOOK, /rehearsal_date/);
  });
});
