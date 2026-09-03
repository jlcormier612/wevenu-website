import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const TURNAROUND = "supabase/migrations/20261319000000_event_turnaround_enforcement.sql";
const PHASE2 = "supabase/migrations/20261316000000_event_availability_assert.sql";
const PHASE3 = "supabase/migrations/20261317000000_event_availability_write_enforcement.sql";
const TOUR_SQL = "supabase/migrations/20261318000000_tour_capacity_enforcement.sql";
const PRECHECK = "lib/availability/precheck.ts";
const CLIENTS_REPO = "lib/clients/repository.ts";
const EVENTS_REPO = "lib/events/repository.ts";

describe("Event turnaround write-path seams", () => {
  const sql = readFileSync(resolve(TURNAROUND), "utf8");
  const executable = sql.replace(/--.*$/gm, "");
  const phase2 = readFileSync(resolve(PHASE2), "utf8");
  const phase3 = readFileSync(resolve(PHASE3), "utf8");
  const tours = readFileSync(resolve(TOUR_SQL), "utf8").replace(/--.*$/gm, "");
  const precheck = readFileSync(resolve(PRECHECK), "utf8");
  const clientsRepo = readFileSync(resolve(CLIENTS_REPO), "utf8");
  const eventsRepo = readFileSync(resolve(EVENTS_REPO), "utf8");

  it("extends assert_event_availability rather than adding a second checker", () => {
    assert.match(sql, /create or replace function public\.assert_event_availability/);
    assert.match(sql, /code', 'event_turnaround'/);
    assert.match(sql, /min_turnaround_hours/);
    assert.match(sql, /event_operational_window/);
    assert.match(sql, /v_c_start < v_x_end \+ v_gap/);
    assert.doesNotMatch(executable, /tour_appointments/);
    assert.doesNotMatch(executable, /max_simultaneous_tours/);
  });

  it("simple venues apply turnaround venue-wide; simultaneous venues apply it per space", () => {
    assert.match(sql, /v_max < 2\s+or \(p_space_id is not null and v_existing\.space_id is not distinct from p_space_id\)/);
    assert.match(sql, /if v_overlap_count >= v_max then[\s\S]*if v_turnaround > 0 then/);
  });

  it("null or non-positive turnaround is no requirement", () => {
    assert.match(sql, /if v_turnaround is null or v_turnaround <= 0 then/);
  });

  it("write trigger still calls assert in the same transaction and expands lock days", () => {
    assert.match(sql, /v_result := public\.assert_event_availability\(/);
    assert.match(sql, /event_turnaround_extra_lock_days/);
    assert.match(sql, /NEW\.event_date - v_extra/);
    assert.doesNotMatch(phase3.replace(/--.*$/gm, ""), /min_turnaround_hours/);
    assert.doesNotMatch(phase2.replace(/--.*$/gm, ""), /event_turnaround/);
  });

  it("Event create/edit/Book This Lead/Direct Add still go through events writes", () => {
    assert.match(eventsRepo, /const row = toEventRow\(/);
    assert.match(eventsRepo, /\.insert\(row\)/);
    assert.match(eventsRepo, /\.update\(toEventRow/);
    assert.match(eventsRepo, /\.update\(\{ status \}\)/);
    assert.match(clientsRepo, /create_client_and_event_with_availability/);
    assert.doesNotMatch(eventsRepo, /assert_event_availability/);
  });

  it("precheck uses the same occupancy evaluator including turnaround", () => {
    assert.match(precheck, /effectiveMinTurnaroundHours/);
    assert.match(precheck, /event_turnaround/);
    assert.match(precheck, /evaluateEventOccupancy/);
  });

  it("does not apply min_turnaround_hours to Tour capacity", () => {
    assert.doesNotMatch(tours, /min_turnaround/);
  });
});
