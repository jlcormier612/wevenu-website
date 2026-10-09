/**
 * Manual Booked confirmation writes occupancy through book_relationship.
 * Contract and payment automation stay non-booking.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { bookingConfirmationError } from "@/lib/booking-journey/confirmed-occupancy";
import { prefillBookingConfirmation } from "@/lib/booking-journey/confirmation-draft";

const root = resolve(process.cwd());
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

const sql = read("supabase/migrations/20261413300000_book_relationship_confirmed_occupancy.sql");
const fnStart = sql.indexOf("create or replace function public.book_relationship");
const fn = sql.slice(fnStart, sql.indexOf("$$;", fnStart));
const book = read("lib/booking-journey/book-client.ts");
const service = read("lib/leads/service.ts");
const dialog = read("components/leads/pipeline-booked-confirm-dialog.tsx");

describe("confirmed booking occupancy", () => {
  it("requires a date and a space when the venue can host more than one event", () => {
    assert.equal(
      bookingConfirmationError({
        eventDate: "",
        eventEndDate: null,
        startTime: null,
        endTime: null,
        spaceId: null,
        assignments: [],
      }, 1),
      "A date is required before booking this relationship.",
    );
    assert.match(
      bookingConfirmationError({
        eventDate: "2099-04-01",
        eventEndDate: null,
        startTime: null,
        endTime: null,
        spaceId: null,
        assignments: [],
      }, 3) ?? "",
      /Event Space/,
    );
    assert.equal(
      bookingConfirmationError({
        eventDate: "2099-04-01",
        eventEndDate: null,
        startTime: null,
        endTime: null,
        spaceId: null,
        assignments: [],
      }, 1),
      null,
    );
  });

  it("prefills from the lead and does not treat a hold as already confirmed", () => {
    const prefill = prefillBookingConfirmation({
      eventType: "wedding",
      eventDate: "2099-04-01",
      endDate: null,
      plannedSpaceId: "barn",
      holds: [{
        status: "active",
        holdDate: "2099-04-01",
        startTime: "10:00:00",
        endTime: "12:00:00",
        spaceId: "garden",
        spaceIds: ["garden"],
      }],
      preferences: [],
      assignments: [],
    });
    assert.equal(prefill.eventDate, "2099-04-01");
    assert.equal(prefill.spaceId, "barn");
    assert.equal(prefill.startTime, "10:00");
    assert.doesNotMatch(dialog, /onConfirm\(\)/);
    assert.match(dialog, /data-testid="booking-confirm-date"/);
    assert.match(dialog, /data-testid="booking-confirm-end-date"/);
    assert.match(dialog, /data-testid="booking-confirm-start"/);
    assert.match(dialog, /data-testid="booking-confirm-end"/);
    assert.match(dialog, /missingRequiredSpace/);
    assert.match(dialog, /excludeLeadId=\{draft\.leadId/);
    assert.match(dialog, /sourceHoldDates/);
  });

  it("passes the submitted occupancy into the one booking transaction", () => {
    assert.match(book, /p_confirmed_occupancy/);
    assert.match(book, /confirmedOccupancy/);
    const confirm = service.slice(service.indexOf("export async function confirmPipelineBookedMove"));
    assert.match(confirm, /confirmedOccupancy: occupancy/);
    assert.match(confirm, /bookingConfirmationError/);
    const ret = service.slice(service.indexOf("export async function returnLeadToBooked"));
    assert.match(ret, /confirmedOccupancy: occupancy/);
    const back = service.slice(service.indexOf("export async function returnClientToBooked"));
    assert.match(back, /confirmedOccupancy: occupancy/);
  });

  it("writes assignments before booked_at and converts overlapping holds in the same function", () => {
    const hold = fn.indexOf("update public.date_holds");
    const assign = fn.indexOf("delete from public.event_space_assignments");
    const stamp = fn.indexOf("booked_at = coalesce(booked_at, v_booked_on)");
    assert.ok(hold > 0 && assign > hold && stamp > assign);
    assert.match(fn, /p_confirmed_occupancy/);
    assert.match(fn, /v_max_sim >= 2/);
    assert.match(fn, /if v_newly and v_lead_id is not null and not v_confirmed/);
    assert.match(fn, /hold_date >= v_event_date/);
  });

  it("contract and payment automation do not book", () => {
    const stamp = read("lib/booking-journey/stamp-commercial-booked-at.ts");
    const contracts = read("lib/contracts/service.ts");
    const payments = read("lib/payments/service.ts");
    for (const source of [stamp, contracts, payments]) {
      assert.doesNotMatch(source, /bookClient\(/);
      assert.doesNotMatch(source, /book_relationship/);
      assert.doesNotMatch(source, /updateLeadSalesStage\([^)]*booked/);
    }
    assert.match(stamp, /return null/);
  });

  it("does not source required vendors from Setup Profile requiredVendorIds", () => {
    const requiredSql = read(
      "supabase/migrations/20261413500000_book_relationship_assign_required_vendors.sql",
    );
    const start = requiredSql.indexOf("create or replace function public.book_relationship");
    const requiredFn = requiredSql.slice(start, requiredSql.indexOf("$$;", start));
    assert.match(requiredFn, /is_required = true/);
    assert.match(requiredFn, /venue_vendor_relationships/);
    assert.doesNotMatch(requiredFn, /template_refs/);
    assert.doesNotMatch(requiredFn, /from public\.venue_setup_profiles/);
  });
});
