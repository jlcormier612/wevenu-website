/**
 * Hold / availability integrity — expiration, lost/cancel release, and
 * assignment revalidation. Does not change Booking Started or Booked semantics.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { holdExpirationInstant } from "@/lib/availability/hold-expiration";
import {
  holdProtectsAvailability,
  holdsConflictWithEachOther,
  type HoldOccupancyRow,
} from "@/lib/availability/hold-occupancy";

const read = (p: string) => readFileSync(resolve(p), "utf8");
const migration = read("supabase/migrations/20261413400000_hold_availability_integrity.sql");
const service = read("lib/availability/service.ts");
const actions = read("app/(app)/availability/actions.ts");
const form = read("components/availability/date-holds-section.tsx");
const assignments = read("lib/events/space-assignments.ts");
const bookingStarted = read("app/(app)/booking-journey/actions.ts");
const bookSql = read("supabase/migrations/20261413300000_book_relationship_confirmed_occupancy.sql");

function row(over: Partial<HoldOccupancyRow> & Pick<HoldOccupancyRow, "holdDate" | "spaceIds">): HoldOccupancyRow {
  return { leadId: "lead-a", startTime: null, endTime: null, ...over };
}

describe("hold expiration timezone", () => {
  it("date-only expiration is the venue-local end of that date", () => {
    const eastern = holdExpirationInstant("2026-07-15", "America/New_York");
    assert.equal(eastern, "2026-07-16T03:59:59.000Z");
    const utc = holdExpirationInstant("2026-07-15", "UTC");
    assert.equal(utc, "2026-07-15T23:59:59.000Z");
    const pacific = holdExpirationInstant("2026-01-15", "America/Los_Angeles");
    assert.equal(pacific, "2026-01-16T07:59:59.000Z");
  });

  it("DST boundaries keep 23:59 in the venue zone after the transition", () => {
    // 2026-03-08 spring forward, 2026-11-01 fall back. End of day is not the 2am gap.
    assert.equal(holdExpirationInstant("2026-03-08", "America/New_York"), "2026-03-09T03:59:59.000Z");
    assert.equal(holdExpirationInstant("2026-11-01", "America/New_York"), "2026-11-02T04:59:59.000Z");
  });

  it("a full timestamp is stored unchanged", () => {
    const iso = "2026-07-15T18:00:00.000Z";
    assert.equal(holdExpirationInstant(iso, "America/New_York"), iso);
    assert.equal(holdExpirationInstant("  ", "America/New_York"), null);
  });

  it("the hold form sends the date, and the server applies the venue zone", () => {
    assert.doesNotMatch(form, /new Date\(expiresAt \+ "T23:59:59"\)/);
    assert.match(form, /venueTimezone/);
    assert.match(service, /holdExpirationInstant/);
  });
});

describe("expired holds do not protect availability", () => {
  const now = Date.parse("2026-10-07T15:00:00.000Z");

  it("active + past expires_at does not protect; null expiry and future expiry do", () => {
    assert.equal(holdProtectsAvailability({ status: "active", expiresAt: "2026-10-01T00:00:00Z" }, now), false);
    assert.equal(holdProtectsAvailability({ status: "active", expiresAt: "2026-10-08T00:00:00Z" }, now), true);
    assert.equal(holdProtectsAvailability({ status: "active", expiresAt: null }, now), true);
    assert.equal(holdProtectsAvailability({ status: "released", expiresAt: null }, now), false);
    assert.equal(holdProtectsAvailability({ status: "expired", expiresAt: null }, now), false);
    assert.equal(holdProtectsAvailability({ status: "converted", expiresAt: null }, now), false);
  });

  it("an expired whole-venue hold does not block a new space hold", () => {
    const expiredWhole: HoldOccupancyRow = row({
      id: "old",
      holdDate: "2099-04-01",
      spaceIds: [],
    });
    const next: HoldOccupancyRow = row({
      id: "new",
      holdDate: "2099-04-01",
      spaceIds: ["garden"],
    });
    assert.equal(holdsConflictWithEachOther(expiredWhole, next, 2), true);
    const protecting = [expiredWhole].filter(() =>
      holdProtectsAvailability({ status: "active", expiresAt: "2020-01-01T00:00:00Z" }, now),
    );
    assert.equal(protecting.length, 0);
    assert.equal(
      protecting.some((h) => holdsConflictWithEachOther(h, next, 2)),
      false,
    );
  });

  it("placement reads only protecting holds", () => {
    assert.match(service, /holdProtectsAvailability\(hold\)/);
    assert.match(read("lib/availability/repository.ts"), /expires_at\.is\.null,expires_at\.gt\./);
    assert.match(migration, /status = 'expired'/);
    assert.match(migration, /expire_elapsed_date_holds/);
  });
});

describe("lost and cancelled release only that lead's protecting holds", () => {
  it("sales_stage lost and cancelled share the release trigger; archive does not", () => {
    assert.match(migration, /NEW\.sales_stage in \('lost', 'cancelled'\)/);
    assert.match(migration, /release_lead_protecting_holds/);
    assert.match(migration, /lead_id = p_lead_id/);
    assert.match(migration, /status = 'released'/);
    assert.doesNotMatch(migration, /archived_at/);
    const releaseFn = migration.slice(
      migration.indexOf("function public.release_lead_protecting_holds"),
      migration.indexOf("function public.leads_release_holds_on_close"),
    );
    assert.doesNotMatch(releaseFn, /public\.events/);
  });
});

describe("convertHoldAction is retired", () => {
  it("the orphaned convert action and service helper are gone", () => {
    assert.doesNotMatch(service, /export async function convertHold\b/);
    assert.doesNotMatch(actions, /convertHoldAction/);
    assert.doesNotMatch(actions, /convertHold/);
    assert.match(service, /export async function releaseHold/);
    assert.match(bookSql, /update public\.date_holds/);
  });
});

describe("assignment edits revalidate the full space set", () => {
  it("replacement is one RPC that forces occupancy even when primary space is unchanged", () => {
    assert.match(assignments, /replace_event_space_assignments/);
    assert.doesNotMatch(assignments, /createAdminClient/);
    assert.match(migration, /htc\.force_event_occupancy/);
    assert.match(migration, /assert_event_availability/);
    assert.match(bookSql, /p_confirmed_occupancy/);
    assert.doesNotMatch(bookSql, /replace_event_space_assignments/);
  });
});

describe("Booking Started and commercial steps stay non-booking", () => {
  it("start booking does not place a hold or call book_relationship", () => {
    const start = bookingStarted.slice(
      bookingStarted.indexOf("export async function startBookingFileAction"),
      bookingStarted.indexOf("export async function ensureCommercialCustomerAction"),
    );
    assert.doesNotMatch(start, /date_holds/);
    assert.doesNotMatch(start, /book_relationship/);
    assert.doesNotMatch(start, /bookClient/);
    assert.match(bookSql, /Contract and payment automation do not call this function/);
  });
});
