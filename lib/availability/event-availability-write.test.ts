import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const WRITE_MIGRATION = "supabase/migrations/20261317000000_event_availability_write_enforcement.sql";
const EVENTS_REPO = "lib/events/repository.ts";
const EVENTS_SERVICE = "lib/events/service.ts";
const CLIENTS_SERVICE = "lib/clients/service.ts";
const CLIENTS_REPO = "lib/clients/repository.ts";

describe("Phase 3 write-path seams", () => {
  const sql = readFileSync(resolve(WRITE_MIGRATION), "utf8");
  const eventsRepo = readFileSync(resolve(EVENTS_REPO), "utf8");
  const eventsService = readFileSync(resolve(EVENTS_SERVICE), "utf8");
  const clientsService = readFileSync(resolve(CLIENTS_SERVICE), "utf8");
  const clientsRepo = readFileSync(resolve(CLIENTS_REPO), "utf8");

  it("enforces occupancy in a BEFORE INSERT/UPDATE trigger, not a separate RPC then write", () => {
    assert.match(sql, /create trigger events_enforce_availability_ins/);
    assert.match(sql, /before insert on public\.events/);
    assert.match(sql, /before update of event_date, event_end_date, setup_time, start_time, end_time, teardown_time, space_id, status/);
    assert.match(sql, /v_result := public\.assert_event_availability\(/);
    assert.match(sql, /case when TG_OP = 'UPDATE' then NEW\.id else null end/);
    assert.doesNotMatch(sql, /Booking\.Confirmed/);
    assert.doesNotMatch(sql.replace(/--.*$/gm, ""), /min_turnaround/);
    assert.doesNotMatch(sql.replace(/--.*$/gm, ""), /max_simultaneous_tours/);
    assert.doesNotMatch(sql.replace(/--.*$/gm, ""), /tour_appointments/);
    assert.doesNotMatch(sql.replace(/--.*$/gm, ""), /calendar_blocks/);
  });

  it("locks the union of old and new protected days in date order on edit", () => {
    assert.match(sql, /generate_series\(v_old_start, v_old_end, interval '1 day'\)/);
    assert.match(sql, /generate_series\(v_new_start, v_new_end, interval '1 day'\)/);
    assert.match(sql, /union/);
    assert.match(sql, /order by d/);
    const unionAt = sql.indexOf("union");
    const assertAt = sql.indexOf("v_result := public.assert_event_availability");
    assert.ok(unionAt > 0 && assertAt > unionAt, "old+new day locks must precede the occupancy assert");
  });

  it("skips cancelled writes and restores occupancy on un-cancel", () => {
    assert.match(sql, /if NEW\.status = 'cancelled' then\s+return NEW;/);
    assert.match(sql, /v_restoring := OLD\.status = 'cancelled'/);
  });

  it("Book This Lead / Direct Add compose Client + Event in one SQL function", () => {
    assert.match(sql, /create or replace function public\.create_client_and_event_with_availability/);
    const clientAt = sql.indexOf("v_client_id := public.create_client_atomic");
    const eventAt = sql.indexOf("insert into public.events (");
    assert.ok(clientAt > 0 && eventAt > clientAt, "Event insert must follow Client insert in the same function");
    assert.match(clientsRepo, /create_client_and_event_with_availability/);
    assert.match(clientsRepo, /insertClientWithDatedEvent/);
    const convert = clientsService.slice(
      clientsService.indexOf("export async function convertLeadToClient"),
      clientsService.indexOf("export async function updateClientInfo"),
    );
    assert.match(convert, /insertClientWithDatedEvent\(/);
    assert.doesNotMatch(convert, /assert_event_availability/);
    const core = clientsService.slice(
      clientsService.indexOf("async function createClientCore"),
      clientsService.indexOf("export async function createClient_"),
    );
    assert.match(core, /insertClientWithDatedEvent\(/);
    assert.doesNotMatch(core, /assert_event_availability/);
  });

  it("Event create/edit/status writes go through table INSERT/UPDATE (trigger), not a standalone assert RPC", () => {
    assert.match(eventsRepo, /const row = toEventRow\(/);
    assert.match(eventsRepo, /\.insert\(row\)/);
    assert.match(eventsRepo, /\.update\(toEventRow/);
    assert.match(eventsRepo, /\.update\(\{ status \}\)/);
    assert.doesNotMatch(eventsRepo, /assert_event_availability/);
    assert.doesNotMatch(eventsService, /checkEventSpaceConflict/);
    assert.doesNotMatch(eventsService, /assert_event_availability/);
    assert.match(eventsService, /occupancyActionFailure/);
    assert.match(eventsService, /repo\.insertEvent\(/);
    assert.match(eventsService, /repo\.updateEvent\(/);
    assert.match(eventsService, /repo\.updateEventStatus\(/);
  });

  it("existing-Client Book This Lead retry returns or creates the Event", () => {
    const convert = clientsService.slice(
      clientsService.indexOf("export async function convertLeadToClient"),
      clientsService.indexOf("export async function updateClientInfo"),
    );
    assert.match(convert, /getEventIdForClient/);
    assert.match(convert, /autoCreateEvent\(/);
    assert.match(convert, /startTime: input\.ceremonyTime/);
    const auto = clientsService.slice(
      clientsService.indexOf("async function autoCreateEvent"),
      clientsService.indexOf("function datedEventFromClient"),
    );
    assert.match(auto, /startTime: opts\.startTime \?\? ""/);
    assert.doesNotMatch(auto, /ceremonyTime: ""/);
  });
});
