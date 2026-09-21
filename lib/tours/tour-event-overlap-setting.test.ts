/**
 * Tour-versus-booked-event overlap is one venue setting.
 * Public slots, public booking, and staff booking all call _is_tour_slot_blocked.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

describe("allow tours during booked events", () => {
  const sql = read("supabase/migrations/20261404300000_allow_tours_during_booked_events.sql");
  const fn = sql.slice(sql.indexOf("create or replace function public._is_tour_slot_blocked"));

  it("defaults off and only skips the booked-event check when the venue allows it", () => {
    assert.match(sql, /allow_tours_during_booked_events boolean not null default false/);
    assert.match(fn, /if not coalesce\(v_allow_during_events, false\)/);
    assert.match(fn, /e\.status is distinct from 'cancelled'/);
    assert.match(fn, /e\.status is distinct from 'complete'/);
    assert.doesNotMatch(sql, /events_enforce_availability/);
    assert.doesNotMatch(sql, /pg_advisory_xact_lock/);
  });

  it("still enforces windows, capacity, exceptions, and calendar blockers", () => {
    const gate = fn.indexOf("if not coalesce(v_allow_during_events, false)");
    const windowCheck = fn.indexOf("_tour_slot_fits_window");
    const capacity = fn.indexOf("_tour_effective_max_simultaneous");
    const blocks = fn.indexOf("covering_calendar_block_title");
    const exceptions = fn.indexOf("tour_availability_exceptions");
    assert.ok(windowCheck >= 0 && windowCheck < gate);
    assert.ok(capacity >= 0 && capacity < gate);
    assert.ok(blocks > gate);
    assert.ok(exceptions > gate);
    assert.match(fn, /blocked_time', 'wedding_event_booking', 'private_event'/);
  });

  it("public slots, public booking, and staff booking share the function", () => {
    const generate = read("supabase/migrations/20261320000000_availability_correction_pass.sql");
    const book = read("supabase/migrations/20261331000000_book_tour_accepted_event_types.sql");
    const staff = read("supabase/migrations/20261322000000_tour_booking_atomicity.sql");
    const trigger = read("supabase/migrations/20261323000000_bring_business_cutover.sql");
    assert.match(generate, /not public\._is_tour_slot_blocked/);
    assert.match(book, /_is_tour_slot_blocked\(v_venue\.id/);
    assert.match(staff, /book_tour_for_lead/);
    assert.match(staff, /_is_tour_slot_blocked/);
    assert.match(trigger, /tour_appointments_enforce_availability/);
    assert.match(trigger, /_is_tour_slot_blocked/);
  });

  it("does not change the public tour URL", () => {
    const link = read("lib/tours/public-link.ts");
    const page = read("app/book/[key]/page.tsx");
    assert.match(link, /\/book\//);
    assert.match(page, /schedule_tour/);
    assert.doesNotMatch(sql, /tour_embed_key/);
  });

  it("the staff pre-check uses the same on/off switch", () => {
    const precheck = read("lib/availability/precheck.ts");
    assert.match(precheck, /allowToursDuringBookedEvents !== true/);
    assert.match(precheck, /overlaps a booked event/);
    const control = read("components/settings/tour-event-overlap-control.tsx");
    assert.match(control, /Allow tours during booked events/);
    assert.match(control, /Choose whether couples can schedule a tour while a booked event is occupying the venue/);
  });
});
