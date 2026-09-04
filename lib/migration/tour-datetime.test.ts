/**
 * Migration tour scheduled-time resolution — pure, DB-independent.
 * See tour-datetime.ts for why this exists: a bare "YYYY-MM-DD HH:MM"
 * (no timezone) must resolve against the venue's own clock, not the
 * server's, and anything that can't be resolved unambiguously must be
 * refused rather than guessed.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveMigrationTourScheduledAt } from "@/lib/migration/tour-datetime";
import { venueLocalToUtcIso } from "@/lib/venue/timezone";

const NY = "America/New_York";

describe("resolveMigrationTourScheduledAt", () => {
  it("resolves a valid future tour given as a bare venue-local date/time", () => {
    const result = resolveMigrationTourScheduledAt("2027-06-12 14:00", NY, venueLocalToUtcIso);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    // 14:00 America/New_York in June (EDT, UTC-4) is 18:00 UTC.
    assert.equal(result.iso, "2027-06-12T18:00:00.000Z");
  });

  it("resolves a valid past tour given as a bare venue-local date/time", () => {
    const result = resolveMigrationTourScheduledAt("2020-01-10 09:30", NY, venueLocalToUtcIso);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    // 09:30 America/New_York in January (EST, UTC-5) is 14:30 UTC.
    assert.equal(result.iso, "2020-01-10T14:30:00.000Z");
  });

  it("accepts a full ISO timestamp with an explicit offset unchanged", () => {
    const result = resolveMigrationTourScheduledAt("2027-06-12T14:00:00-04:00", NY, venueLocalToUtcIso);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.iso, new Date("2027-06-12T14:00:00-04:00").toISOString());
  });

  it("accepts a full ISO timestamp with Z", () => {
    const result = resolveMigrationTourScheduledAt("2027-06-12T18:00:00Z", NY, venueLocalToUtcIso);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.iso, "2027-06-12T18:00:00.000Z");
  });

  it("refuses a malformed date outright", () => {
    const result = resolveMigrationTourScheduledAt("not-a-date", NY, venueLocalToUtcIso);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /ambiguous or malformed/);
  });

  it("refuses an out-of-range calendar date (e.g. month 13) rather than silently rolling over", () => {
    const result = resolveMigrationTourScheduledAt("2027-13-45 10:00", NY, venueLocalToUtcIso);
    assert.equal(result.ok, false);
  });

  it("refuses a date with no time component — ambiguous, not a safe default", () => {
    const result = resolveMigrationTourScheduledAt("2027-06-12", NY, venueLocalToUtcIso);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /ambiguous or malformed/);
  });

  it("refuses an invalid time (e.g. 25:00) rather than rolling over to the next day", () => {
    const result = resolveMigrationTourScheduledAt("2027-06-12 25:00", NY, venueLocalToUtcIso);
    assert.equal(result.ok, false);
  });

  it("timezone boundary: 23:30 venue-local resolves to the correct UTC calendar day, not the server's", () => {
    const result = resolveMigrationTourScheduledAt("2027-06-12 23:30", NY, venueLocalToUtcIso);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    // 23:30 EDT (UTC-4) on June 12 is 03:30 UTC on June 13 — crossing the
    // UTC day boundary. A naive same-day UTC interpretation of "23:30" would
    // wrongly place this at 2027-06-12T23:30:00Z, a different instant and
    // potentially a different past/future classification near midnight.
    assert.equal(result.iso, "2027-06-13T03:30:00.000Z");
    assert.notEqual(result.iso, "2027-06-12T23:30:00.000Z");
  });

  it("defaults to America/New_York when the venue has no timezone set, same as every other tour writer", () => {
    const result = resolveMigrationTourScheduledAt("2027-06-12 14:00", null, venueLocalToUtcIso);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.iso, "2027-06-12T18:00:00.000Z");
  });
});
