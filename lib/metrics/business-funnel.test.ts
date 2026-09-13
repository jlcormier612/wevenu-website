/**
 * Business Funnel product rules.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  BUSINESS_FUNNEL_LEADLESS_NOTE,
  BUSINESS_FUNNEL_OUTSTANDING_LIMITATION,
  cohortRatePercent,
  computeBusinessFunnelCohortStats,
  isBusinessFunnelCohortLead,
} from "@/lib/metrics/business-funnel";
import {
  isBusinessFunnelCohortLead as sharedCohortFilter,
  leadHasLifecycleBooking,
} from "@/lib/metrics/cohort-population";

const funnelSrc = readFileSync(resolve("lib/metrics/business-funnel.ts"), "utf8");
const overview = readFileSync(resolve("app/(app)/reporting/page.tsx"), "utf8");
const salesPage = readFileSync(resolve("app/(app)/reporting/sales/page.tsx"), "utf8");
const bookingsPage = readFileSync(resolve("app/(app)/reporting/bookings/page.tsx"), "utf8");
const component = readFileSync(resolve("components/reporting/business-funnel.tsx"), "utf8");
const registry = readFileSync(resolve("lib/metrics/registry.ts"), "utf8");
const attribution = readFileSync(resolve("lib/metrics/attribution.ts"), "utf8");
const revenue = readFileSync(resolve("lib/metrics/revenue.ts"), "utf8");
const revenuePage = readFileSync(resolve("app/(app)/reporting/revenue/page.tsx"), "utf8");

describe("Business Funnel cohort population", () => {
  it("keeps Lost leads in the cohort (Lost is not Delete)", () => {
    assert.equal(isBusinessFunnelCohortLead({ status: "new", sales_stage: "responded" }), true);
    assert.equal(isBusinessFunnelCohortLead({ status: "new", sales_stage: "lost" }), true);
    assert.equal(isBusinessFunnelCohortLead({ status: "cancelled", sales_stage: "lost" }), true);
    assert.equal(sharedCohortFilter, isBusinessFunnelCohortLead);
  });

  it("counts Lead → Booking including later Lost, and undated first_booked events", () => {
    const stats = computeBusinessFunnelCohortStats([
      { id: "1", status: "new", sales_stage: "responded", first_booked_at: "2026-02-01", eventuallyToured: true },
      { id: "2", status: "new", sales_stage: "tour_scheduled", first_booked_at: null, eventuallyToured: true },
      { id: "3", status: "new", sales_stage: "responded", first_booked_at: "2026-02-10", eventuallyToured: false },
      { id: "4", status: "new", sales_stage: "lost", first_booked_at: null, eventuallyToured: true },
      { id: "5", status: "new", sales_stage: "lost", first_booked_at: "2026-01-20", eventuallyToured: true },
      { id: "6", status: "new", sales_stage: "booked", first_booked_at: null, hasFirstBookedEvent: true, eventuallyToured: false },
    ]);
    assert.equal(stats.leadsEntered, 6);
    assert.equal(stats.eventuallyToured, 4);
    assert.equal(stats.eventuallyBooked, 4);
    assert.equal(stats.touredAndBooked, 2);
    assert.equal(stats.leadToBookingRate, cohortRatePercent(4, 6));
  });

  it("treats first_booked_at or first_booked event as a Booking", () => {
    assert.equal(leadHasLifecycleBooking({ first_booked_at: "2026-01-01" }), true);
    assert.equal(leadHasLifecycleBooking({ first_booked_at: null, hasFirstBookedEvent: true }), true);
    assert.equal(leadHasLifecycleBooking({ first_booked_at: null, hasFirstBookedEvent: false }), false);
  });

  it("returns 0% when denominator is empty", () => {
    assert.equal(cohortRatePercent(0, 0), 0);
    const empty = computeBusinessFunnelCohortStats([]);
    assert.equal(empty.leadToTourRate, 0);
    assert.equal(empty.tourToBookingRate, 0);
  });
});

describe("Business Funnel composition seams", () => {
  it("period Tours use tour_appointments.scheduled_at", () => {
    assert.match(funnelSrc, /tour_appointments/);
    assert.match(funnelSrc, /scheduled_at/);
  });

  it("period Bookings reuse dated lifecycle first_booked via getLifecycleBookings", () => {
    assert.match(funnelSrc, /getLifecycleBookings/);
    assert.match(funnelSrc, /getGrossBookedRevenue/);
    assert.match(funnelSrc, /getPaymentsCollected/);
    assert.match(funnelSrc, /getOutstandingBalance/);
    assert.doesNotMatch(funnelSrc, /getCanonicalBookings/);
  });

  it("does not invent period tour÷booking conversion", () => {
    assert.doesNotMatch(funnelSrc, /periodTours\s*\/\s*periodBookings/);
    assert.doesNotMatch(funnelSrc, /bookings\.length\s*\/\s*.*tours/);
    assert.match(component, /not conversion rates/);
  });

  it("documents mixed-clock Outstanding and leadless Direct Add note", () => {
    assert.match(BUSINESS_FUNNEL_OUTSTANDING_LIMITATION, /different clocks/);
    assert.match(BUSINESS_FUNNEL_LEADLESS_NOTE, /never a lead/i);
    assert.match(component, /outstandingLimitation/);
    assert.match(component, /leadlessNote/);
  });

  it("Collected and Outstanding reuse authoritative revenue RPCs", () => {
    assert.match(revenue, /canonical_payments_collected/);
    assert.match(revenue, /canonical_outstanding_balance/);
    assert.match(funnelSrc, /getOutstandingBalance/);
  });

  it("does not read mutable leads.source for historical attribution", () => {
    assert.doesNotMatch(funnelSrc, /leads\.source/);
    assert.doesNotMatch(funnelSrc, /leads\(source\)/);
    assert.match(attribution, /acquisition_source/);
  });
});

describe("Business Funnel Reporting surfaces", () => {
  it("Overview mounts Business Funnel and lifecycle Bookings", () => {
    assert.match(overview, /BusinessFunnel|getBusinessFunnel/);
    assert.match(overview, /getLifecycleBookings/);
    assert.match(overview, /getLeadCohortLifecycleBookingStats/);
    assert.doesNotMatch(overview, /Financially Committed/);
    assert.doesNotMatch(overview, /getCanonicalBookings/);
  });

  it("Sales separates period activity from cohort conversion", () => {
    assert.match(salesPage, /Cohort performance/);
    assert.match(salesPage, /Period activity/);
    assert.match(salesPage, /getLeadCohortLifecycleBookingStats/);
    assert.match(salesPage, /later marked Lost/);
    assert.doesNotMatch(salesPage, /Financially Committed/);
    assert.doesNotMatch(salesPage, /Bookings by origin/);
  });

  it("Bookings page is lifecycle-dated without a second booking type", () => {
    assert.match(bookingsPage, /getLifecycleBookingsWithNames/);
    assert.match(bookingsPage, /Bookings by source/);
    assert.doesNotMatch(bookingsPage, /Bookings by origin/);
    assert.doesNotMatch(bookingsPage, /Financially Committed/);
    assert.doesNotMatch(bookingsPage, /originLabel/);
  });

  it("Revenue stays financial and does not name a Financially Committed tile", () => {
    assert.match(revenuePage, /Contracted/);
    assert.doesNotMatch(revenuePage, /Financially Committed/);
  });

  it("Registry still documents lifecycle vs financial internals", () => {
    assert.match(registry, /Lifecycle Booking/);
    assert.match(registry, /occurred_at|first_booked/);
  });
});
