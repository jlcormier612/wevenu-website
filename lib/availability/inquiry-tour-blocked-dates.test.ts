/**
 * Regression: public inquiry must honor Settings → Blocked Dates
 * (tour_availability_exceptions), including annual Christmas.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { tourExceptionCoversDate } from "@/lib/tours/blocked-date-recurrence";

const MIGRATION = resolve(
  "supabase/migrations/20261415000000_inquiry_honors_tour_blocked_dates.sql",
);

describe("inquiry honors tour blocked dates (annual Christmas class)", () => {
  const sql = readFileSync(MIGRATION, "utf8");

  it("annual December 25 covers 2026, 2027, and 2030; ordinary dates do not", () => {
    const christmas = {
      startDate: "2026-12-25",
      endDate: "2026-12-25",
      recurrenceRule: "annual" as const,
    };
    assert.equal(tourExceptionCoversDate(christmas, "2026-12-25"), true);
    assert.equal(tourExceptionCoversDate(christmas, "2027-12-25"), true);
    assert.equal(tourExceptionCoversDate(christmas, "2030-12-25"), true);
    assert.equal(tourExceptionCoversDate(christmas, "2026-12-24"), false);
    assert.equal(tourExceptionCoversDate(christmas, "2026-12-26"), false);
  });

  it("one-time blocked date covers only its range inclusive", () => {
    const span = {
      startDate: "2026-12-24",
      endDate: "2026-12-26",
      recurrenceRule: "none" as const,
    };
    assert.equal(tourExceptionCoversDate(span, "2026-12-24"), true);
    assert.equal(tourExceptionCoversDate(span, "2026-12-25"), true);
    assert.equal(tourExceptionCoversDate(span, "2026-12-26"), true);
    assert.equal(tourExceptionCoversDate(span, "2026-12-27"), false);
    assert.equal(tourExceptionCoversDate(span, "2027-12-25"), false);
  });

  it("SQL helper + _is_event_date_available consult tour exceptions before availability", () => {
    assert.match(sql, /create or replace function public\.tour_availability_exception_covers_date/);
    assert.match(sql, /calendar_block_covers_interval/);
    assert.match(sql, /recurrence_rule, 'none'\) = 'annual'/);
    const fn = sql.slice(sql.indexOf("create or replace function public._is_event_date_available"));
    const tourAt = fn.indexOf("tour_availability_exception_covers_date");
    const coverAt = fn.indexOf("covering_calendar_block_title");
    const holdAt = fn.indexOf("from public.date_holds");
    assert.ok(tourAt > 0 && coverAt > tourAt, "tour exceptions before calendar_blocks");
    assert.ok(holdAt > coverAt, "closures before hold/occupancy early returns");
    assert.match(fn, /tour Blocked Dates/);
  });

  it("create_public_lead still revalidates choose_available against _is_event_date_available", () => {
    const inquiry = readFileSync(
      resolve("supabase/migrations/20261410200000_lead_inquiry_message_origin.sql"),
      "utf8",
    );
    assert.match(
      inquiry,
      /v_mode = 'choose_available'[\s\S]*_is_event_date_available\(v_venue_id, p_event_date\)/,
    );
  });

  it("public dates API uses get_available_event_dates (SQL authority)", () => {
    const route = readFileSync(
      resolve("app/api/public/inquiry-available-dates/route.ts"),
      "utf8",
    );
    assert.match(route, /get_available_event_dates/);
  });
});
