import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  formatTourBlockedDateSpan,
  tourBlockedRecurrenceLabel,
  tourExceptionCoversDate,
} from "@/lib/tours/blocked-date-recurrence";

const migration = readFileSync(
  resolve("supabase/migrations/20261413200000_tour_availability_exception_annual.sql"),
  "utf8",
);
const editor = readFileSync(resolve("components/settings/tour-availability-editor.tsx"), "utf8");
const service = readFileSync(resolve("lib/tours/service.ts"), "utf8");

describe("one-time blocked dates", () => {
  it("covers the inclusive range and nothing outside it", () => {
    const exc = { startDate: "2027-06-14", endDate: "2027-06-16", recurrenceRule: "none" as const };
    assert.equal(tourExceptionCoversDate(exc, "2027-06-13"), false);
    assert.equal(tourExceptionCoversDate(exc, "2027-06-14"), true);
    assert.equal(tourExceptionCoversDate(exc, "2027-06-16"), true);
    assert.equal(tourExceptionCoversDate(exc, "2027-06-17"), false);
    assert.equal(tourExceptionCoversDate(exc, "2028-06-14"), false);
  });
});

describe("annual recurring blocked dates", () => {
  it("blocks the matching single date in future years without materialising rows", () => {
    const exc = { startDate: "2026-03-17", endDate: "2026-03-17", recurrenceRule: "annual" as const };
    assert.equal(tourExceptionCoversDate(exc, "2026-03-17"), true);
    assert.equal(tourExceptionCoversDate(exc, "2027-03-17"), true);
    assert.equal(tourExceptionCoversDate(exc, "2028-03-17"), true);
    assert.equal(tourExceptionCoversDate(exc, "2027-03-16"), false);
    assert.equal(tourExceptionCoversDate(exc, "2027-03-18"), false);
  });

  it("blocks matching annual ranges including year wrap", () => {
    const exc = { startDate: "2026-12-24", endDate: "2027-01-01", recurrenceRule: "annual" as const };
    assert.equal(tourExceptionCoversDate(exc, "2026-12-24"), true);
    assert.equal(tourExceptionCoversDate(exc, "2026-12-31"), true);
    assert.equal(tourExceptionCoversDate(exc, "2027-01-01"), true);
    assert.equal(tourExceptionCoversDate(exc, "2027-12-24"), true);
    assert.equal(tourExceptionCoversDate(exc, "2028-01-01"), true);
    assert.equal(tourExceptionCoversDate(exc, "2027-12-23"), false);
    assert.equal(tourExceptionCoversDate(exc, "2028-01-02"), false);
  });
});

describe("display + UX wiring", () => {
  it("labels annual rules Every year and formats month/day spans", () => {
    assert.equal(tourBlockedRecurrenceLabel("none"), null);
    assert.equal(tourBlockedRecurrenceLabel("annual"), "Every year");
    assert.equal(
      formatTourBlockedDateSpan("2026-12-25", "2026-12-25", "annual"),
      "December 25",
    );
    assert.match(
      formatTourBlockedDateSpan("2026-12-24", "2027-01-01", "annual"),
      /December 24 – January 1/,
    );
  });

  it("UI offers Does not repeat / Every year and defaults to none", () => {
    assert.match(editor, /Does not repeat/);
    assert.match(editor, /Every year/);
    assert.match(editor, /recurrenceRule: "none"/);
    assert.match(editor, /formatTourBlockedDateSpan/);
  });

  it("persists recurrence_rule and SQL reuses calendar annual coverage", () => {
    assert.match(service, /recurrence_rule: recurrenceRule/);
    assert.match(migration, /recurrence_rule in \('none', 'annual'\)/);
    assert.match(migration, /calendar_block_covers_interval/);
    assert.match(migration, /recurrenceRule/);
    assert.doesNotMatch(migration, /insert into public\.tour_availability_exceptions[\s\S]*generate_series/);
  });
});
