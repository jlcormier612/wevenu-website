import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const MIGRATION = "supabase/migrations/20261321000000_calendar_block_recurrence_coverage.sql";
const PRECHECK = "lib/availability/precheck.ts";
const REPO = "lib/availability/repository.ts";
const CLIENTS = "lib/clients/service.ts";
const COVERAGE = "lib/availability/calendar-block-coverage.ts";

describe("recurring calendar_blocks seams", () => {
  const sql = readFileSync(resolve(MIGRATION), "utf8");
  const precheck = readFileSync(resolve(PRECHECK), "utf8");
  const repo = readFileSync(resolve(REPO), "utf8");
  const clients = readFileSync(resolve(CLIENTS), "utf8");
  const coverage = readFileSync(resolve(COVERAGE), "utf8");

  it("write-path covering uses occurrence expansion, not first-span dates only", () => {
    assert.match(sql, /create or replace function public\.covering_calendar_block_title/);
    assert.match(sql, /create or replace function public\._calendar_occurrence_starts/);
    assert.match(sql, /v_rule = 'weekly'/);
    assert.match(sql, /_calendar_add_months/);
    assert.match(coverage, /expandOccurrenceStarts/);
    assert.doesNotMatch(
      sql.slice(sql.indexOf("create or replace function public.events_enforce_availability")),
      /cb\.start_date <= v_prot_end/,
    );
  });

  it("Event writes evaluate covering after occupancy and take the calendar-blocks lock", () => {
    const trigger = sql.slice(
      sql.indexOf("create or replace function public.events_enforce_availability"),
      sql.indexOf("create or replace function public.calendar_blocks_lock_event_days"),
    );
    const assertAt = trigger.indexOf("v_result := public.assert_event_availability");
    const lockAt = trigger.indexOf("hashtext('calendar-blocks')");
    const coverAt = trigger.indexOf("covering_calendar_block_title");
    assert.ok(assertAt > 0 && lockAt > assertAt && coverAt > lockAt);
    assert.match(trigger, /hint = 'calendar_blocked'/);
  });

  it("precheck and Book This Lead / Direct Add use the same covering helper", () => {
    assert.match(precheck, /coveringCalendarBlockTitle/);
    assert.match(clients, /coveringClientEventBlockTitle|coveringCalendarBlockTitle/);
    assert.match(repo, /recurrence_rule/);
    assert.match(repo, /mapCalendarBlockRow/);
  });

  it("Tour covering still filters to closing types only", () => {
    assert.match(sql, /array\['blocked_time', 'wedding_event_booking', 'private_event'\]/);
    assert.match(precheck, /TOUR_CLOSING_CALENDAR_BLOCK_TYPES/);
  });
});
