/**
 * Date hold lifecycle — Client ≠ Booked; holds consume only at book_relationship.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const root = resolve(process.cwd());
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

const clients = read("lib/clients/service.ts");
const convertFn = clients.slice(
  clients.indexOf("export async function convertLeadToClient"),
  clients.indexOf("export async function updateClientInfo"),
);
const bookSql = read(
  "supabase/migrations/20261412100000_authoritative_booked_membership.sql",
);
const bookFn = bookSql.slice(
  bookSql.indexOf("create or replace function public.book_relationship"),
  bookSql.indexOf("$$;", bookSql.indexOf("create or replace function public.book_relationship")),
);
const commercial = read("lib/booking-journey/ensure-commercial-customer.ts");
const startBooking = read("app/(app)/booking-journey/actions.ts");
const enforce = read(
  "supabase/migrations/20261407400000_hold_same_owner_exclusion.sql",
);

describe("date hold lifecycle — Client does not consume holds", () => {
  it("convertLeadToClient does not convert date_holds", () => {
    assert.doesNotMatch(convertFn, /convertLeadHolds/);
    assert.doesNotMatch(convertFn, /date_holds/);
    assert.doesNotMatch(convertFn, /status:\s*["']converted["']/);
    assert.match(convertFn, /bookClient is the only pipeline-Booked write|Booked transition/);
  });

  it("start booking file and commercial ensure do not call bookClient", () => {
    const start = startBooking.slice(startBooking.indexOf("export async function startBookingFileAction"));
    assert.match(start, /convertLeadToClient/);
    assert.doesNotMatch(start, /bookClient/);
    assert.match(commercial, /commercialOnly:\s*true/);
    assert.doesNotMatch(commercial, /bookClient/);
  });
});

describe("date hold lifecycle — Booked consumes own hold", () => {
  it("book_relationship converts this lead's overlapping active holds before Event occupancy", () => {
    assert.match(bookFn, /update public\.date_holds/);
    assert.match(bookFn, /status = 'converted'/);
    assert.match(bookFn, /lead_id = v_lead_id/);
    assert.match(bookFn, /status = 'active'/);
    assert.match(bookFn, /hold_date >= v_event_date/);
    // Convert before insert/update that stamps booked_at.
    const convertAt = bookFn.indexOf("update public.date_holds");
    const insertAt = bookFn.indexOf("insert into public.events");
    const stampAt = bookFn.indexOf("booked_at = v_booked_on");
    assert.ok(convertAt > 0);
    assert.ok(insertAt > convertAt);
    assert.ok(stampAt > convertAt);
  });

  it("does not rename hold statuses or invent a new status", () => {
    const holdUpdates = bookFn.match(/update public\.date_holds[\s\S]*?where[\s\S]*?;/g) ?? [];
    assert.ok(holdUpdates.length >= 1);
    for (const u of holdUpdates) {
      assert.match(u, /set status = 'converted'/);
      assert.doesNotMatch(u, /'consumed'|'superseded'|set status = 'booked'/);
    }
    assert.doesNotMatch(bookSql, /alter table public\.date_holds/);
  });

  it("other leads' holds still block via events_enforce_availability", () => {
    assert.match(enforce, /h\.status = 'active'/);
    assert.match(enforce, /c\.lead_id = h\.lead_id/);
    assert.match(enforce, /hold_blocks/);
  });

  it("confirmation also converts this lead's source hold dates without touching another lead", () => {
    const latest = read("supabase/migrations/20261414100000_book_relationship_source_hold_dates.sql");
    const fn = latest.slice(latest.indexOf("create or replace function public.book_relationship"));
    assert.match(fn, /sourceHoldDates/);
    assert.match(fn, /lead_id = v_lead_id/);
    assert.match(fn, /hold_date >= v_event_date/);
    assert.doesNotMatch(fn, /set status = 'converted'[\s\S]{0,120}lead_id is null/);
  });

  it("does not bulk-restore historical converted holds", () => {
    assert.doesNotMatch(
      bookSql,
      /update public\.date_holds[\s\S]*?set status = 'active'/,
    );
  });

  it("already-Booked re-entry consumes leftover active holds on the Event date", () => {
    // The 2026-09-28 incident left 20261408300000 unapplied. Relationships
    // booked before that apply (e.g. Taylor Morgan) can still have an active
    // hold. The RPC must self-heal those leftovers on the next authoritative
    // book_relationship call — not invent a new status, and not require a
    // hand-edit of the hold row.
    const alreadyBooked = bookFn.slice(
      bookFn.indexOf("v_event_id is not null and v_existing_booked_at is not null"),
      bookFn.indexOf("elsif v_event_id is not null and v_existing_booked_at is null"),
    );
    assert.match(alreadyBooked, /leftover active holds/);
    assert.match(alreadyBooked, /set status = 'converted'/);
    assert.match(alreadyBooked, /status = 'active'/);
    assert.match(alreadyBooked, /hold_date = v_existing_date/);
    assert.match(alreadyBooked, /lead_id = v_lead_id/);
    assert.doesNotMatch(alreadyBooked, /insert into public\.events/);
  });
});
