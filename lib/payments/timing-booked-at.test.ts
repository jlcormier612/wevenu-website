/**
 * Payment timing / booked_at product rules — unit + source-seam tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { SCHEDULE_PRESETS } from "@/lib/payments/constants";
import {
  formatTimingLabel,
  resolveDueDateFromTiming,
} from "@/lib/payments/starters";

describe("Payment timing — At booking vs before event", () => {
  it("At booking is not equivalent to 0 days before the event", () => {
    assert.notEqual(
      formatTimingLabel({ type: "at_booking" }),
      formatTimingLabel({ type: "before_event", days: 0 }),
    );
    const ctx = { eventDate: "2026-10-17", bookingDate: "2025-01-10" };
    assert.equal(resolveDueDateFromTiming({ type: "at_booking" }, ctx), "2025-01-10");
    assert.equal(resolveDueDateFromTiming({ type: "before_event", days: 0 }, ctx), "2026-10-17");
  });

  it("Jan 10 booking + Oct 17 event resolves at-booking and before-event correctly", () => {
    const ctx = { eventDate: "2026-10-17", bookingDate: "2025-01-10" };
    assert.equal(resolveDueDateFromTiming({ type: "at_booking" }, ctx), "2025-01-10");
    assert.equal(resolveDueDateFromTiming({ type: "before_event", days: 60 }, ctx), "2026-08-18");
    assert.equal(resolveDueDateFromTiming({ type: "before_event", days: 14 }, ctx), "2026-10-03");
  });

  it("missing booked_at does not become today's date in the resolver", () => {
    const today = new Date().toISOString().slice(0, 10);
    const due = resolveDueDateFromTiming(
      { type: "at_booking" },
      { eventDate: "2026-10-17", bookingDate: null },
    );
    assert.equal(due, null);
    assert.notEqual(due, today);
  });

  it("starter deposits use at_booking timing", () => {
    for (const id of ["thirds", "wedding_four", "fifty_fifty", "deposit_30_70"]) {
      const preset = SCHEDULE_PRESETS.find((p) => p.id === id)!;
      assert.equal(preset.items[0]!.timing.type, "at_booking", id);
    }
  });
});

describe("Payment timing — financial paths never stamp booked_at", () => {
  it("createPaymentSchedule and regeneratePaymentSchedule do not call ensureEventBookedAt", () => {
    const src = readFileSync(resolve("lib/payments/service.ts"), "utf8");
    assert.doesNotMatch(src, /ensureEventBookedAt/);
    assert.doesNotMatch(src, /venueToday/);
    assert.match(src, /Add the booking date on the Event to continue/);
  });

  it("status transitions do not stamp booked_at", () => {
    const src = readFileSync(resolve("lib/events/service.ts"), "utf8");
    const statusFn = src.slice(src.indexOf("export async function updateEventStatus_"));
    const body = statusFn.slice(0, statusFn.indexOf("export async function updateEventBookedAt_"));
    assert.doesNotMatch(body, /ensureEventBookedAt|setEventBookedAt/);
  });

  it("Owner/Manager booked_at correction exists and does not touch payment lines", () => {
    const src = readFileSync(resolve("lib/events/service.ts"), "utf8");
    assert.match(src, /export async function updateEventBookedAt_/);
    assert.match(src, /Only an Owner or Manager can set or correct the booking date/);
    assert.match(src, /Existing payment due dates were not changed/);
    const repo = readFileSync(resolve("lib/events/repository.ts"), "utf8");
    const setFn = repo.slice(repo.indexOf("export async function setEventBookedAt"));
    assert.doesNotMatch(setFn.slice(0, 400), /payment_line/);
  });
});

describe("Payment timing — genuine commercial booking moment stamps", () => {
  it("lead conversion does not stamp booked_at; commercial helper does", () => {
    const src = readFileSync(resolve("lib/clients/service.ts"), "utf8");
    const convert = src.slice(src.indexOf("export async function convertLeadToClient"));
    assert.doesNotMatch(convert, /stampBookingDateIfNeeded|ensureEventBookedAt/);
    const stamp = readFileSync(resolve("lib/booking-journey/stamp-commercial-booked-at.ts"), "utf8");
    assert.match(stamp, /maybeStampCommercialBookedAt/);
    assert.match(stamp, /isCommerciallyBooked/);
  });

  it("Direct Add does not stamp booked_at for live dated bookings", () => {
    const src = readFileSync(resolve("lib/clients/service.ts"), "utf8");
    const core = src.slice(src.indexOf("async function createClientCore"));
    const body = core.slice(0, core.indexOf("export async function createClient_"));
    assert.doesNotMatch(body, /stampBookingDateIfNeeded|ensureEventBookedAt/);
  });

  it("markLineItemPaid and Stripe success call commercial stamp", () => {
    assert.match(
      readFileSync(resolve("lib/payments/service.ts"), "utf8"),
      /maybeStampCommercialBookedAt/,
    );
    assert.match(
      readFileSync(resolve("lib/stripe/webhook-handlers.ts"), "utf8"),
      /maybeStampCommercialBookedAt/,
    );
  });
});

describe("Payment timing — migration booked_at", () => {
  it("uses explicit bookedAt only — not contractSignedAt", () => {
    const commitSrc = readFileSync(resolve("lib/migration/active-commitment.ts"), "utf8");
    const modelSrc = readFileSync(resolve("lib/migration/active-commitment-model.ts"), "utf8");
    assert.match(commitSrc, /n\.bookedAt\?\.trim\(\)/);
    assert.match(commitSrc, /ensureEventBookedAt\(client, venueId, resolvedEventId, n\.bookedAt/);
    assert.doesNotMatch(
      commitSrc,
      /ensureEventBookedAt\([^)]*contractSignedAt/,
    );
    // Invariant lives on the NormalizedActiveCommitment type (client-safe model)
    // and is restated at the ensureEventBookedAt call site in the commit module.
    assert.match(modelSrc, /never derive booked_at from the signed date/i);
    assert.match(commitSrc, /never reinterpret contractSignedAt/i);
    assert.match(commitSrc, /never treat this as lifecycle Booking/i);
  });
});

describe("Payment timing — contract signing stamps booked_at only via commercial Booked helper", () => {
  it("contract paths may call maybeStampCommercialBookedAt but not write booked_at directly", () => {
    // Commercial Booked = agreement + deposit. Signing may complete that milestone
    // when a deposit is already paid — via maybeStampCommercialBookedAt only.
    const service = readFileSync(resolve("lib/contracts/service.ts"), "utf8");
    const external = readFileSync(resolve("lib/contracts/external-execution.ts"), "utf8");
    assert.match(service, /maybeStampCommercialBookedAt/);
    assert.match(external, /maybeStampCommercialBookedAt/);
    for (const file of [
      "lib/contracts/service.ts",
      "lib/contracts/finalize.ts",
      "lib/contracts/external-execution.ts",
      "lib/contracts/repository.ts",
      "lib/contracts/pdf.ts",
      "lib/contracts/preview.ts",
      "lib/contracts/signature-blocks.ts",
    ]) {
      const src = readFileSync(resolve(file), "utf8");
      assert.doesNotMatch(src, /ensureEventBookedAt|setEventBookedAt|\.booked_at|bookedAt:/, `${file}`);
    }
  });
});

describe("Payment timing — Owner/Manager permission gate on booking-date correction", () => {
  it("checks the role and returns before any write happens", () => {
    const src = readFileSync(resolve("lib/events/service.ts"), "utf8");
    const fnStart = src.indexOf("export async function updateEventBookedAt_");
    assert.ok(fnStart >= 0, "updateEventBookedAt_ must exist");
    const nextFnStart = src.indexOf("\nexport async function ", fnStart + 1);
    const body = src.slice(fnStart, nextFnStart > 0 ? nextFnStart : undefined);

    const roleCheckAt = body.indexOf('role !== "owner" && role !== "manager"');
    const rejectionAt = body.indexOf("Only an Owner or Manager can set or correct the booking date");
    const setBookedAtAt = body.indexOf("repo.setEventBookedAt");

    assert.ok(roleCheckAt >= 0, "must check the current user's role");
    assert.ok(rejectionAt >= 0, "must reject non-Owner/Manager roles with an explicit message");
    assert.ok(setBookedAtAt >= 0, "must call the repository write");
    // The rejection message must live inside the same conditional as the role
    // check (i.e. actually gate the write), not just appear somewhere later.
    assert.ok(roleCheckAt < rejectionAt && rejectionAt < setBookedAtAt,
      "the permission check must run and reject before the booking date is ever written");
  });
});

describe("Payment timing — 50/25/25 starter", () => {
  it("expresses 50% at booking, 25% at 60 days before event, 25% at 14 days before event", () => {
    const preset = SCHEDULE_PRESETS.find((p) => p.id === "fifty_25_25");
    assert.ok(preset, "fifty_25_25 preset must exist");
    if (!preset) return;
    assert.equal(preset.items.length, 3);
    assert.equal(preset.items[0]!.timing.type, "at_booking");
    assert.equal(preset.items[0]!.pctOfTotal, 50);
    assert.deepEqual(preset.items[1]!.timing, { type: "before_event", days: 60 });
    assert.equal(preset.items[1]!.pctOfTotal, 25);
    assert.deepEqual(preset.items[2]!.timing, { type: "before_event", days: 14 });
    assert.equal(preset.items[2]!.pctOfTotal, 25);
    const total = preset.items.reduce((sum, i) => sum + i.pctOfTotal, 0);
    assert.equal(total, 100);
  });

  it("resolves the correct calendar dates for a fixed booking/event date pair", () => {
    const preset = SCHEDULE_PRESETS.find((p) => p.id === "fifty_25_25")!;
    const ctx = { eventDate: "2027-06-12", bookingDate: "2025-12-01" };
    assert.equal(resolveDueDateFromTiming(preset.items[0]!.timing, ctx), "2025-12-01");
    assert.equal(resolveDueDateFromTiming(preset.items[1]!.timing, ctx), "2027-04-13");
    assert.equal(resolveDueDateFromTiming(preset.items[2]!.timing, ctx), "2027-05-29");
  });
});
