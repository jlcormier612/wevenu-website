/**
 * Phase 2B — Business Funnel pure math + seam contracts.
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
import { isBusinessFunnelCohortLead as sharedCohortFilter } from "@/lib/metrics/cohort-population";

const funnelSrc = readFileSync(resolve("lib/metrics/business-funnel.ts"), "utf8");
const overview = readFileSync(resolve("app/(app)/reporting/page.tsx"), "utf8");
const salesPage = readFileSync(resolve("app/(app)/reporting/sales/page.tsx"), "utf8");
const component = readFileSync(resolve("components/reporting/business-funnel.tsx"), "utf8");
const registry = readFileSync(resolve("lib/metrics/registry.ts"), "utf8");
const attribution = readFileSync(resolve("lib/metrics/attribution.ts"), "utf8");
const revenue = readFileSync(resolve("lib/metrics/revenue.ts"), "utf8");

describe("Business Funnel cohort population", () => {
  it("excludes cancelled and sales_stage lost from the NEW cohort population", () => {
    assert.equal(isBusinessFunnelCohortLead({ status: "new", sales_stage: "responded" }), true);
    assert.equal(isBusinessFunnelCohortLead({ status: "cancelled", sales_stage: "responded" }), false);
    assert.equal(isBusinessFunnelCohortLead({ status: "new", sales_stage: "lost" }), false);
    assert.equal(isBusinessFunnelCohortLead({ status: "cancelled", sales_stage: "lost" }), false);
    assert.equal(sharedCohortFilter, isBusinessFunnelCohortLead);
  });

  it("computes Lead → Tour, Lead → Booking, Tour → Booking as cohort rates only", () => {
    const stats = computeBusinessFunnelCohortStats([
      { id: "1", status: "new", sales_stage: "responded", first_booked_at: "2026-02-01", eventuallyToured: true },
      { id: "2", status: "new", sales_stage: "tour_scheduled", first_booked_at: null, eventuallyToured: true },
      { id: "3", status: "new", sales_stage: "responded", first_booked_at: "2026-02-10", eventuallyToured: false },
      { id: "4", status: "cancelled", sales_stage: "responded", first_booked_at: "2026-02-01", eventuallyToured: true },
      { id: "5", status: "new", sales_stage: "lost", first_booked_at: null, eventuallyToured: true },
    ]);
    // Population = 3 (ids 1–3); cancelled/lost dropped
    assert.equal(stats.leadsEntered, 3);
    assert.equal(stats.eventuallyToured, 2);
    assert.equal(stats.eventuallyBooked, 2);
    assert.equal(stats.touredAndBooked, 1);
    assert.equal(stats.leadToTourRate, cohortRatePercent(2, 3));
    assert.equal(stats.leadToBookingRate, cohortRatePercent(2, 3));
    assert.equal(stats.tourToBookingRate, cohortRatePercent(1, 2));
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

  it("period Bookings reuse lifecycle first_booked via getLifecycleBookings", () => {
    assert.match(funnelSrc, /getLifecycleBookings/);
    assert.match(funnelSrc, /getCanonicalBookings/);
    assert.match(funnelSrc, /getGrossBookedRevenue/);
    assert.match(funnelSrc, /getPaymentsCollected/);
    assert.match(funnelSrc, /getOutstandingBalance/);
  });

  it("does not invent period tour÷booking conversion", () => {
    assert.doesNotMatch(funnelSrc, /periodTours\s*\/\s*periodBookings/);
    assert.doesNotMatch(funnelSrc, /bookings\.length\s*\/\s*.*tours/);
    assert.match(component, /not conversion rates/);
    assert.match(component, /do not divide one by the other/);
  });

  it("documents mixed-clock Outstanding and leadless note", () => {
    assert.match(BUSINESS_FUNNEL_OUTSTANDING_LIMITATION, /different clocks/);
    assert.match(BUSINESS_FUNNEL_LEADLESS_NOTE, /Leadless \/ Direct \/ Import/);
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
  it("Overview mounts Business Funnel prominently", () => {
    assert.match(overview, /BusinessFunnel|getBusinessFunnel/);
    assert.match(overview, /from \"@\/components\/reporting\/business-funnel\"/);
  });

  it("Sales aligns terminology without duplicating the full funnel", () => {
    assert.match(salesPage, /Business Funnel/);
    assert.match(salesPage, /\/reporting/);
    assert.doesNotMatch(salesPage, /getBusinessFunnel/);
  });

  it("Registry documents Business Funnel clocks", () => {
    assert.match(registry, /Business Funnel/);
    assert.match(registry, /scheduled_at/);
    assert.match(registry, /occurred_at|first_booked/);
    assert.match(registry, /mixed.?clock/i);
  });

  it("leaves room for Phase 2C Website layer without inventing visitors", () => {
    assert.match(component, /Phase 2C/);
    assert.match(funnelSrc, /Phase 2C/);
    assert.doesNotMatch(component, /\b12,?480\b|website visitors/i);
    assert.doesNotMatch(funnelSrc, /session_id|ga4/i);
    assert.doesNotMatch(funnelSrc, /getWebsiteVisitors|visitorCount/);
  });
});
