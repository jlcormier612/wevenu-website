import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const CORRECTION = "supabase/migrations/20261320000000_availability_correction_pass.sql";
const REPO = "lib/availability/repository.ts";
const OCCUPANCY = "lib/availability/event-occupancy.ts";
const INQUIRY_SQL = "supabase/migrations/20261309000000_inquiry_form_config.sql";

describe("availability correction pass seams", () => {
  const sql = readFileSync(resolve(CORRECTION), "utf8");
  const repo = readFileSync(resolve(REPO), "utf8");
  const occupancy = readFileSync(resolve(OCCUPANCY), "utf8");
  const inquiry = readFileSync(resolve(INQUIRY_SQL), "utf8");

  it("splits occupancy evaluation from write locks so inquiry does not lock Event days", () => {
    assert.match(sql, /create or replace function public\.evaluate_event_availability/);
    assert.match(sql, /create or replace function public\.assert_event_availability/);
    const evaluateAt = sql.indexOf("create or replace function public.evaluate_event_availability");
    const assertAt = sql.indexOf("create or replace function public.assert_event_availability");
    const evaluate = sql.slice(evaluateAt, assertAt);
    assert.doesNotMatch(evaluate.replace(/--.*$/gm, ""), /pg_advisory_xact_lock/);
    assert.doesNotMatch(evaluate.replace(/--.*$/gm, ""), /calendar_blocks/);
    assert.match(evaluate, /code', 'event_turnaround'/);
    const assertFn = sql.slice(assertAt, sql.indexOf("create or replace function public._is_event_date_available"));
    assert.match(assertFn, /pg_advisory_xact_lock/);
    assert.match(assertFn, /return public\.evaluate_event_availability\(/);
  });

  it("inquiry date availability reuses evaluate rather than a second occupancy implementation", () => {
    const fn = sql.slice(
      sql.indexOf("create or replace function public._is_event_date_available"),
      sql.indexOf("create or replace function public.events_enforce_availability"),
    );
    assert.match(fn, /evaluate_event_availability/);
    assert.match(fn, /calendar_blocks/);
    assert.doesNotMatch(fn, /insert into public\.events/);
    assert.match(inquiry, /get_available_event_dates/);
    assert.match(inquiry, /_is_event_date_available\(v_venue_id, v_cur\)/);
    assert.match(occupancy, /export function isInquiryEventDateAvailable/);
  });

  it("Event writes re-check covering calendar_blocks after occupancy locks", () => {
    const trigger = sql.slice(
      sql.indexOf("create or replace function public.events_enforce_availability"),
      sql.indexOf("create or replace function public.calendar_blocks_lock_event_days"),
    );
    const assertAt = trigger.indexOf("v_result := public.assert_event_availability");
    const blockAt = trigger.indexOf("from public.calendar_blocks");
    assert.ok(assertAt > 0 && blockAt > assertAt, "calendar_blocks check must follow occupancy assert");
    assert.match(trigger, /hint = 'calendar_blocked'/);
    assert.match(sql, /lock_event_occupancy_days\(NEW\.venue_id, NEW\.start_date, NEW\.end_date\)/);
  });

  it("keeps the unused assertEventAvailability RPC wrapper for diagnostics", () => {
    assert.match(repo, /export async function assertEventAvailability/);
    assert.match(repo, /This helper remains for tests and diagnostics/);
    assert.doesNotMatch(repo, /await assertEventAvailability\(/);
  });

  it("Event\/Tour and slot generation use venues.timezone", () => {
    assert.match(sql, /_venue_scheduling_timezone/);
    assert.match(sql, /America\/New_York/);
    assert.match(sql, /\(v_cursor_date \+ v_window\.start_time\) at time zone v_tz/);
  });
});
