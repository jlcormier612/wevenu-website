import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const ATOMICITY = "supabase/migrations/20261322000000_tour_booking_atomicity.sql";
const PHASE4 = "supabase/migrations/20261318000000_tour_capacity_enforcement.sql";
const EVENTS_SERVICE = "lib/events/service.ts";
const CLIENTS_REPO = "lib/clients/repository.ts";
const CLIENTS_SERVICE = "lib/clients/service.ts";
const TOURS_SERVICE = "lib/tours/service.ts";
const CONFLICT = "components/availability/conflict-warning.tsx";
const PRECHECK = "lib/availability/precheck.ts";
const MIGRATION_SERVICE = "lib/migration/service.ts";

describe("Tour booking atomicity seams", () => {
  const sql = readFileSync(resolve(ATOMICITY), "utf8");
  const phase4 = readFileSync(resolve(PHASE4), "utf8");

  it("drops the leftover 12-arg book_tour overload so public booking is unambiguous", () => {
    assert.match(
      sql,
      /drop function if exists public\.book_tour\(text, timestamptz, text, text, text, text, text, text, text, integer, text, text\)/,
    );
  });

  it("wraps ingest_lead and appointment INSERT in one exception subtransaction", () => {
    const bookAt = sql.indexOf("create or replace function public.book_tour(");
    const book = sql.slice(bookAt, sql.indexOf("create or replace function public.book_tour_for_lead("));
    const beginAt = book.indexOf("\n  begin\n    v_result := public.ingest_lead(");
    const insertAt = book.indexOf("insert into public.tour_appointments");
    const exceptAt = book.indexOf("exception\n    when raise_exception then");
    assert.ok(beginAt > 0, "ingest_lead must sit inside a BEGIN block");
    assert.ok(insertAt > beginAt, "appointment INSERT must follow ingest_lead in the same block");
    assert.ok(exceptAt > insertAt, "exception handler must follow the INSERT");
    assert.match(book.slice(exceptAt), /slot_unavailable/);
    // Old pattern: ingest_lead outside the exception block before INSERT.
    const old = phase4.slice(
      phase4.indexOf("create or replace function public.book_tour("),
      phase4.indexOf("create or replace function public.book_tour_for_lead("),
    );
    const oldIngest = old.indexOf("v_result := public.ingest_lead(");
    const oldBeginInsert = old.indexOf("begin\n    insert into public.tour_appointments");
    assert.ok(oldIngest > 0 && oldBeginInsert > oldIngest, "phase4 fixture still documents the prior non-atomic shape");
  });

  it("takes the calendar-blocks advisory lock before Tour availability evaluation", () => {
    assert.match(sql, /hashtext\('calendar-blocks'\)/);
    const triggerAt = sql.indexOf("create or replace function public.tour_appointments_enforce_availability()");
    const trigger = sql.slice(triggerAt, sql.indexOf("create or replace function public.book_tour("));
    const lockAt = trigger.indexOf("hashtext('calendar-blocks')");
    const checkAt = trigger.indexOf("_is_tour_slot_blocked");
    assert.ok(lockAt > 0 && checkAt > lockAt, "trigger must lock calendar-blocks before the check");

    const book = sql.slice(sql.indexOf("create or replace function public.book_tour("));
    const bookLock = book.indexOf("hashtext('calendar-blocks')");
    const bookCheck = book.indexOf("_is_tour_slot_blocked");
    assert.ok(bookLock > 0 && bookCheck > bookLock, "book_tour must lock calendar-blocks before the check");
  });
});

describe("Event / Tour application path availability seams", () => {
  const eventsService = readFileSync(resolve(EVENTS_SERVICE), "utf8");
  const clientsRepo = readFileSync(resolve(CLIENTS_REPO), "utf8");
  const clientsService = readFileSync(resolve(CLIENTS_SERVICE), "utf8");
  const toursService = readFileSync(resolve(TOURS_SERVICE), "utf8");
  const conflict = readFileSync(resolve(CONFLICT), "utf8");
  const precheck = readFileSync(resolve(PRECHECK), "utf8");
  const migrationService = readFileSync(resolve(MIGRATION_SERVICE), "utf8");

  it("Event create/edit/status restore map occupancy and calendar-block refusals", () => {
    assert.match(eventsService, /occupancyActionFailure/);
    assert.match(eventsService, /occupancyFailureFromUnknown/);
    assert.match(eventsService, /calendarBlockFailureFromUnknown/);
    assert.match(eventsService, /export async function updateEvent_/);
    assert.match(eventsService, /export async function updateEventStatus_/);
    const updateAt = eventsService.indexOf("export async function updateEvent_");
    const statusAt = eventsService.indexOf("export async function updateEventStatus_");
    assert.match(eventsService.slice(updateAt, statusAt), /occupancyActionFailure/);
    assert.match(eventsService.slice(statusAt, statusAt + 800), /occupancyActionFailure/);
  });

  it("Direct Add / Book This Lead use the transactional Client+Event RPC", () => {
    assert.match(clientsRepo, /create_client_and_event_with_availability/);
    assert.match(clientsRepo, /insertClientWithDatedEvent/);
    assert.match(clientsService, /insertClientWithDatedEvent/);
    // RPC body has no exception handler that swallows Event refusal — Client rolls back with it.
    const phase3 = readFileSync(resolve("supabase/migrations/20261317000000_event_availability_write_enforcement.sql"), "utf8");
    const rpc = phase3.slice(phase3.indexOf("create or replace function public.create_client_and_event_with_availability"));
    assert.doesNotMatch(rpc.slice(0, rpc.indexOf("notify pgrst")), /exception\s+when/);
    assert.match(rpc, /v_client_id := public\.create_client_atomic/);
    assert.match(rpc, /insert into public\.events/);
  });

  it("dated import creates Clients through the same availability-aware Client path", () => {
    assert.match(clientsService, /historicalImport/);
    assert.match(clientsService, /createClientForVenue/);
    assert.match(clientsService, /insertClientWithDatedEvent/);
    assert.match(migrationService, /createClientForVenue|createClient_/);
  });

  it("Tour coordinator book/reschedule/status map capacity refusals through tour_appointments", () => {
    assert.match(toursService, /book_tour_for_lead/);
    assert.match(toursService, /reschedule_tour/);
    assert.match(toursService, /updateTourStatus/);
    assert.match(toursService, /tourCapacityFailureFromUnknown/);
    assert.match(toursService, /from\("tour_appointments"\)/);
  });

  it("ConflictWarning exposes turnaround, space, capacity, and calendar-block failure types", () => {
    assert.match(conflict, /event_turnaround/);
    assert.match(conflict, /calendar_blocked/);
    assert.match(conflict, /tour_capacity_full/);
    assert.match(conflict, /tour_event_overlap/);
    assert.match(conflict, /tour_outside_window/);
    assert.match(precheck, /occupancyConflictType/);
    assert.match(precheck, /space_booked/);
    assert.match(precheck, /event_capacity_full/);
    assert.match(precheck, /event_turnaround/);
  });
});
