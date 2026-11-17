import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { knownOriginalBookingDate } from "@/lib/booking-journey/import-booked-event";
import { findDuplicateImportedEvent } from "@/lib/import/client-event-commit";
import {
  contractedInWindow,
  sumAmounts,
  totalsByEvent,
} from "@/lib/metrics/financial-grain";
import {
  dateInWindow,
  isActiveBookedEvent,
  isCancelledEvent,
  leadPerformanceOn,
} from "@/lib/reporting/performance-dates";
import { evaluateEventVolume } from "@/shared/pricing/event-volume";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const NOV_2026 = { from: "2026-11-01", to: "2026-11-30" };

describe("reporting integrity calculations", () => {
  it("A. Morgan is one client and three events, not three conversions", () => {
    const events = [
      { id: "wedding", status: "confirmed" as const, eventDate: "2028-06-14", bookedAt: null },
      { id: "rehearsal", status: "confirmed" as const, eventDate: "2028-06-14", bookedAt: null },
      { id: "later", status: "confirmed" as const, eventDate: "2029-04-02", bookedAt: null },
    ];
    const volume = evaluateEventVolume({ events, asOfDate: "2026-11-17" });
    assert.equal(volume.byYear[2028], 2);
    assert.equal(volume.byYear[2029], 1);
    assert.equal(volume.peakCount, 2);
    const active = events.filter((event) => isActiveBookedEvent({
      status: event.status,
      eventDate: event.eventDate,
      today: "2026-11-17",
    }));
    assert.equal(active.length, 3);
    const leads = [{ id: "only-if-attributed", salesStage: "new_inquiry", relationshipId: "morgan" }];
    const conversions = leads.filter((lead) => lead.salesStage === "booked");
    assert.equal(new Set(leads.map((lead) => lead.relationshipId)).size, 1);
    assert.equal(conversions.length, 0);
    assert.equal(knownOriginalBookingDate(""), null);
    assert.equal(knownOriginalBookingDate("2025-03-01"), "2025-03-01");
  });

  it("B. Riley keeps five inquiries and does not convert the oldest", () => {
    const leads = [
      { id: "1", inquiryDate: "2024-01-01", salesStage: "new_inquiry" },
      { id: "2", inquiryDate: "2024-06-01", salesStage: "new_inquiry" },
      { id: "3", inquiryDate: "2025-02-01", salesStage: "new_inquiry" },
      { id: "4", inquiryDate: "2025-09-01", salesStage: "new_inquiry" },
      { id: "5", inquiryDate: null, salesStage: "new_inquiry" },
    ];
    const periods = leads.map((lead) => leadPerformanceOn({
      isHistoricalImport: true,
      inquiryDate: lead.inquiryDate,
      createdAt: "2026-11-17T15:00:00.000Z",
    }));
    assert.deepEqual(periods, ["2024-01-01", "2024-06-01", "2025-02-01", "2025-09-01", null]);
    assert.equal(periods.filter((day) => dateInWindow(day, NOV_2026)).length, 0);
    assert.equal(leads.filter((lead) => lead.salesStage === "booked").length, 0);
    assert.equal(leads.length, 5);
  });

  it("C. a shared email does not merge two people", () => {
    const people = [
      { relationshipId: "person-a", email: "shared@example.com", leadId: "lead-a", salesStage: "booked" },
      { relationshipId: "person-b", email: "shared@example.com", leadId: "lead-b", salesStage: "new_inquiry" },
    ];
    assert.equal(new Set(people.map((person) => person.relationshipId)).size, 2);
    assert.equal(people.filter((person) => person.salesStage === "booked").length, 1);
  });

  it("D. a completed 2023 import is not a November 2026 booking or current volume", () => {
    const volume = evaluateEventVolume({
      events: [{ id: "hist", status: "complete", eventDate: "2023-08-12", bookedAt: null }],
      asOfDate: "2026-11-17",
    });
    assert.equal(volume.peakCount, 0);
    assert.equal(dateInWindow("2023-08-12", { from: "2023-01-01", to: "2023-12-31" }), true);
    assert.equal(dateInWindow(null, NOV_2026), false);
    assert.equal(isActiveBookedEvent({ status: "complete", eventDate: "2023-08-12", today: "2026-11-17" }), false);
    assert.equal(knownOriginalBookingDate(undefined), null);
  });

  it("E. a 2028 import keeps a 2025 booking date and does not book in November 2026", () => {
    const known = knownOriginalBookingDate("2025-04-09");
    const unknown = knownOriginalBookingDate("not-a-date");
    assert.equal(known, "2025-04-09");
    assert.equal(unknown, null);
    assert.equal(dateInWindow(known, NOV_2026), false);
    assert.equal(dateInWindow(unknown, NOV_2026), false);
    for (const bookedAt of [known, unknown]) {
      const volume = evaluateEventVolume({
        events: [{ id: "future", status: "confirmed", eventDate: "2028-09-09", bookedAt }],
        asOfDate: "2026-11-17",
      });
      assert.equal(volume.byYear[2028], 1);
      assert.equal(isActiveBookedEvent({
        status: "confirmed",
        eventDate: "2028-09-09",
        today: "2026-11-17",
      }), true);
    }
  });

  it("F. a completed current-year event counts without an original booking date", () => {
    const volume = evaluateEventVolume({
      events: [{ id: "done", status: "complete", eventDate: "2026-05-02", bookedAt: null }],
      asOfDate: "2026-11-17",
    });
    assert.equal(volume.byYear[2026], 1);
    assert.equal(volume.peakCount, 1);
  });

  it("G. cancelled events stay identifiable and rebooked volume counts once", () => {
    assert.equal(isCancelledEvent("cancelled"), true);
    assert.equal(isActiveBookedEvent({ status: "cancelled", eventDate: "2028-01-01", today: "2026-11-17" }), false);
    const cancelled = evaluateEventVolume({
      events: [{ id: "cx", status: "cancelled", eventDate: "2028-01-01", bookedAt: "2025-01-01" }],
      asOfDate: "2026-11-17",
    });
    assert.equal(cancelled.peakCount, 0);
    const rebooked = evaluateEventVolume({
      events: [{ id: "same-event", status: "confirmed", eventDate: "2028-01-01", bookedAt: null }],
      asOfDate: "2026-11-17",
    });
    assert.equal(rebooked.peakCount, 1);
  });

  it("H. same-date retry is a duplicate and a different date is an additional event", () => {
    const existing = [{ id: "event-1", eventDate: "2028-06-14", status: "confirmed" }];
    assert.equal(findDuplicateImportedEvent(existing, "2028-06-14")?.id, "event-1");
    assert.equal(findDuplicateImportedEvent(existing, "2029-04-02"), null);
    assert.equal(findDuplicateImportedEvent(
      [{ id: "gone", eventDate: "2028-06-14", status: "cancelled" }],
      "2028-06-14",
    ), null);
  });

  it("I. three invoices stay on their own events and issue dates", () => {
    const invoices = [
      { id: "inv-1", clientId: "morgan", eventId: "wedding", issuedAt: "2025-04-01", subtotal: 10000, discountAmount: 0, status: "issued" },
      { id: "inv-2", clientId: "morgan", eventId: "rehearsal", issuedAt: "2025-04-01", subtotal: 2500, discountAmount: 0, status: "issued" },
      { id: "inv-3", clientId: "morgan", eventId: "later", issuedAt: "2026-11-02", subtotal: 8000, discountAmount: 500, status: "issued" },
      { id: "voided", clientId: "morgan", eventId: "later", issuedAt: "2026-11-02", subtotal: 999, discountAmount: 0, status: "void" },
    ];
    const november = contractedInWindow(invoices, NOV_2026);
    const allTime = contractedInWindow(invoices, {});
    assert.equal(sumAmounts(november), 7500);
    assert.equal(november.length, 1);
    assert.equal(sumAmounts(allTime), 20000);
    assert.deepEqual(Object.fromEntries(totalsByEvent(allTime)), {
      wedding: 10000,
      rehearsal: 2500,
      later: 7500,
    });
    const undated = contractedInWindow([
      { id: "undated", clientId: "morgan", eventId: "wedding", issuedAt: null, subtotal: 100, discountAmount: 0, status: "issued" },
    ], NOV_2026);
    assert.equal(undated.length, 0);
    assert.equal(sumAmounts(contractedInWindow([
      { id: "undated", clientId: "morgan", eventId: "wedding", issuedAt: null, subtotal: 100, discountAmount: 0, status: "issued" },
    ], {})), 100);
  });

  it("J. a native inquiry uses the HTC creation date", () => {
    assert.equal(leadPerformanceOn({
      isHistoricalImport: false,
      inquiryDate: null,
      createdAt: "2026-11-17T18:30:00.000Z",
    }), "2026-11-17");
    assert.equal(dateInWindow("2026-11-17", NOV_2026), true);
  });
});

describe("reporting integrity source locks", () => {
  it("import does not call book_relationship or stamp today as the booking date", () => {
    const added = read("lib/booking-journey/add-imported-event.ts");
    const service = read("lib/clients/service.ts");
    const imported = read("lib/booking-journey/import-booked-event.ts");
    assert.doesNotMatch(added, /bookClient\(/);
    assert.doesNotMatch(added, /utcTodayIso|bookedAt:/);
    assert.doesNotMatch(added, /recordLifecycleBooking/);
    assert.match(added, /insertImportedBookedEvent/);
    assert.match(service, /insertImportedBookedEvent/);
    assert.doesNotMatch(imported, /bookClient\(|rpc\("book_relationship"|bookedAt:/);
    assert.match(imported, /stampOriginalBookingDate/);
    const native = read("lib/booking-journey/book-client.ts");
    assert.match(native, /book_relationship/);
  });

  it("migration separates dates without rewriting booked_at", () => {
    const sql = read("supabase/migrations/20270125120000_reporting_integrity_dates.sql");
    assert.match(sql, /original_booked_on date/);
    assert.match(sql, /performance_inquiry_on/);
    assert.match(sql, /when v_is_historical then nullif/);
    assert.match(sql, /issued_at is not null/);
    assert.match(sql, /event_occupies_calendar/);
    assert.match(sql, /l\.sales_stage = 'booked'/);
    assert.doesNotMatch(sql, /update\s+public\.events[\s\S]{0,120}set\s+booked_at/i);
    assert.doesNotMatch(sql, /e\.booked_at is not null/);
  });

  it("duplicate matching does not gain a booking-date fingerprint", () => {
    const match = read("lib/import/client-event-match.ts");
    assert.doesNotMatch(match, /originalBookedOn|original_booked_on/);
  });
});
