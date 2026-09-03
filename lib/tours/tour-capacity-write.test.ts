import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const WRITE_MIGRATION = "supabase/migrations/20261318000000_tour_capacity_enforcement.sql";
const TOURS_SERVICE = "lib/tours/service.ts";
const LEADS_REPO = "lib/leads/repository.ts";
const PHASE3 = "supabase/migrations/20261317000000_event_availability_write_enforcement.sql";

describe("Phase 4 Tour write-path seams", () => {
  const sql = readFileSync(resolve(WRITE_MIGRATION), "utf8");
  const executable = sql.replace(/--.*$/gm, "");
  const toursService = readFileSync(resolve(TOURS_SERVICE), "utf8");
  const leadsRepo = readFileSync(resolve(LEADS_REPO), "utf8");
  const phase3 = readFileSync(resolve(PHASE3), "utf8");

  it("enforces Tour capacity in a BEFORE INSERT/UPDATE trigger with namespaced advisory locks", () => {
    assert.match(sql, /create trigger tour_appointments_enforce_availability_ins/);
    assert.match(sql, /before insert on public\.tour_appointments/);
    assert.match(sql, /before update of scheduled_at, duration_minutes, status/);
    assert.match(sql, /pg_advisory_xact_lock/);
    assert.match(sql, /hashtext\('tour-avail:' \|\| p_venue_id::text\)/);
    const lockAt = sql.indexOf("perform public.lock_tour_occupancy_interval");
    const checkAt = sql.indexOf("if public._is_tour_slot_blocked(");
    assert.ok(lockAt > 0 && checkAt > lockAt, "trigger must lock before the availability check");
    assert.match(sql, /v_count >= v_max/);
    assert.match(sql, /_tour_effective_max_simultaneous/);
  });

  it("does not use Event occupancy, Event Spaces, or max_simultaneous_events for Tours", () => {
    assert.doesNotMatch(executable, /max_simultaneous_events/);
    assert.doesNotMatch(executable, /assert_event_availability/);
    assert.doesNotMatch(executable, /venue_spaces/);
    assert.doesNotMatch(executable, /venue_mode/);
    assert.doesNotMatch(executable, /min_turnaround/);
  });

  it("Event→Tour conflict uses operational-window overlap, not event_date-only blocking", () => {
    assert.match(sql, /event_operational_window/);
    assert.match(sql, /Does not consume max_simultaneous_tours/);
    assert.doesNotMatch(sql.replace(/--.*$/gm, ""), /e\.event_date = p_slot_start::date/);
    const slotGen = readFileSync(resolve("supabase/migrations/20261129000000_tour_scheduling_completion.sql"), "utf8");
    assert.match(slotGen, /not public\._is_tour_slot_blocked\(p_venue_id, v_slot_start, v_slot_end/);
  });

  it("treats a missing max_simultaneous_tours row as 1", () => {
    assert.match(sql, /if v_max is null or v_max < 1 then\s+return 1;/);
  });

  it("RPCs lock the same keys before check+write rather than SELECT then a later INSERT", () => {
    const bookAt = sql.indexOf("create or replace function public.book_tour(");
    const book = sql.slice(bookAt);
    const lockAt = book.indexOf("lock_tour_occupancy_interval(v_venue.id");
    const checkAt = book.indexOf("_is_tour_slot_blocked(v_venue.id");
    const insertAt = book.indexOf("insert into public.tour_appointments");
    assert.ok(lockAt > 0 && checkAt > lockAt && insertAt > checkAt, "book_tour must lock, check, then insert");

    const leadAt = sql.indexOf("create or replace function public.book_tour_for_lead(");
    const lead = sql.slice(leadAt, sql.indexOf("create or replace function public.reschedule_tour("));
    assert.ok(lead.indexOf("lock_tour_occupancy_interval") < lead.indexOf("_is_tour_slot_blocked"));
    assert.ok(lead.indexOf("_is_tour_slot_blocked") < lead.indexOf("insert into public.tour_appointments"));

    const reschedule = sql.slice(sql.indexOf("create or replace function public.reschedule_tour("));
    assert.ok(reschedule.indexOf("lock_tour_occupancy_interval") < reschedule.indexOf("_is_tour_slot_blocked"));
    assert.ok(reschedule.indexOf("_is_tour_slot_blocked") < reschedule.indexOf("update public.tour_appointments"));
    assert.match(reschedule, /p_appointment_id/);
  });

  it("window fit originally used UTC wall clock; correction pass uses venue timezone", () => {
    assert.match(sql, /p_slot_start at time zone 'UTC'/);
    const correction = readFileSync(resolve("supabase/migrations/20261320000000_availability_correction_pass.sql"), "utf8");
    assert.match(correction, /_venue_scheduling_timezone/);
    assert.match(correction, /p_slot_start at time zone v_tz/);
    assert.match(correction, /\(g\.day\)::date \+ w\.window_start\) at time zone v_tz/);
    assert.doesNotMatch(correction.replace(/--.*$/gm, ""), /at time zone 'UTC'/);
  });

  it("application write paths map trigger refusals and still go through tour_appointments", () => {
    assert.match(toursService, /book_tour/);
    assert.match(toursService, /book_tour_for_lead/);
    assert.match(toursService, /reschedule_tour/);
    assert.match(toursService, /tourCapacityFailureFromUnknown/);
    assert.match(leadsRepo, /tour_appointments/);
    assert.match(leadsRepo, /TourCapacityWriteError/);
  });

  it("does not modify Phase 3 Event write enforcement", () => {
    assert.match(phase3, /create trigger events_enforce_availability_ins/);
    assert.doesNotMatch(phase3.replace(/--.*$/gm, ""), /tour_appointments/);
    assert.doesNotMatch(phase3.replace(/--.*$/gm, ""), /max_simultaneous_tours/);
  });
});
