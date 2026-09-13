/**
 * Lifecycle Booking Truth — source seams + pure behavior contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const migration = readFileSync(
  resolve("supabase/migrations/20261337000000_lifecycle_booking_events.sql"),
  "utf8",
);
const unknownDateMigration = readFileSync(
  resolve("supabase/migrations/20261382000000_lifecycle_booking_unknown_date.sql"),
  "utf8",
);
const backfillMigration = readFileSync(
  resolve("supabase/migrations/20261383000000_lifecycle_booking_backfill_existing.sql"),
  "utf8",
);
const lifecycleSvc = readFileSync(resolve("lib/lifecycle-bookings/service.ts"), "utf8");
const leadsSvc = readFileSync(resolve("lib/leads/service.ts"), "utf8");
const clientsSvc = readFileSync(resolve("lib/clients/service.ts"), "utf8");
const commitment = readFileSync(resolve("lib/migration/active-commitment.ts"), "utf8");
const review = readFileSync(resolve("components/settings/active-commitment-review.tsx"), "utf8");
const overview = readFileSync(resolve("app/(app)/reporting/page.tsx"), "utf8");
const bookingsPage = readFileSync(resolve("app/(app)/reporting/bookings/page.tsx"), "utf8");
const salesPage = readFileSync(resolve("app/(app)/reporting/sales/page.tsx"), "utf8");
const revenuePage = readFileSync(resolve("app/(app)/reporting/revenue/page.tsx"), "utf8");
const registry = readFileSync(resolve("lib/metrics/registry.ts"), "utf8");

describe("Lifecycle booking schema", () => {
  it("defines write-once first_booked uniqueness for lead and leadless client", () => {
    assert.match(migration, /lifecycle_booking_events_first_lead/);
    assert.match(migration, /lifecycle_booking_events_first_client_leadless/);
    assert.match(migration, /event_kind = 'first_booked'/);
    assert.match(migration, /leads\.first_booked_at/);
    assert.match(migration, /clients\.lifecycle_booked_at/);
    assert.match(migration, /lifecycle_booking_origin/);
    assert.match(migration, /origin text not null check \(origin in \('pipeline', 'direct', 'import'\)\)/);
  });

  it("does not redefine events.booked_at", () => {
    assert.doesNotMatch(migration, /alter table public\.events/);
    assert.match(migration, /Distinct from lifecycle Bookings/);
  });

  it("allows unknown historical Booking dates without fabricating a period", () => {
    assert.match(unknownDateMigration, /occurred_at drop not null/);
    assert.match(unknownDateMigration, /occurred_at is not null/);
  });

  it("backfills pre-existing Booked records without inventing a date", () => {
    assert.match(backfillMigration, /pre_existing_booked/);
    assert.match(backfillMigration, /l\.first_booked_at/);
    assert.match(backfillMigration, /sales_stage = 'booked'/);
    assert.doesNotMatch(backfillMigration, /from public\.events/);
    assert.doesNotMatch(backfillMigration, /now\(\)/);
  });

  it("enriches sales_stage activity with previous stage", () => {
    assert.match(migration, /Previous stage:/);
  });
});

describe("Lifecycle booking writers", () => {
  it("period Bookings exclude rebooked so a later return is not a second Booking", () => {
    const listFn = lifecycleSvc.slice(lifecycleSvc.indexOf("export async function listLifecycleBookingsInPeriod"));
    assert.match(listFn, /eq\("event_kind", "first_booked"\)/);
    assert.match(lifecycleSvc, /rebooked is excluded on purpose/);
    assert.match(registry, /not period Booking activity/);
    assert.match(salesPage, /Currently Booked \(pipeline\)/);
  });

  it("pipeline Booked records lifecycle and skips when already Booked", () => {
    assert.match(leadsSvc, /recordLifecycleBooking/);
    assert.match(leadsSvc, /previousStage !== "booked"/);
    assert.match(leadsSvc, /origin: "pipeline"/);
  });

  it("convertLeadToClient passes clientId and sets Booked on race path", () => {
    const convert = clientsSvc.slice(clientsSvc.indexOf("export async function convertLeadToClient"));
    assert.match(convert, /allowBooked: true, clientId/);
    assert.match(convert, /23505[\s\S]*updateLeadSalesStage\(lead\.id, "booked"/);
  });

  it("Direct Add records origin=direct for live dated creates", () => {
    assert.match(clientsSvc, /origin: "direct"/);
    assert.match(clientsSvc, /origin: "import"/);
    assert.match(clientsSvc, /else if \(eventId\)/);
  });

  it("imported booked clients are Bookings; unknown dates are not fabricated", () => {
    assert.match(commitment, /recordImportLifecycle/);
    assert.match(commitment, /occurredAt: knownDate/);
    assert.match(lifecycleSvc, /raw === null\) return null/);
    assert.match(review, /When did you book them/);
    assert.doesNotMatch(review, /Mark as already booked/);
    assert.doesNotMatch(review, /leave blank to use today/);
    assert.doesNotMatch(review, /events\.booked_at/);
  });

  it("direct/import retries do not emit rebooked", () => {
    assert.match(lifecycleSvc, /input\.origin !== "pipeline"/);
    assert.match(lifecycleSvc, /wasFirst: false/);
  });

  it("first_booked denormalized dates use null-only updates", () => {
    assert.match(lifecycleSvc, /\.is\("first_booked_at", null\)/);
    assert.match(lifecycleSvc, /\.is\("lifecycle_booked_at", null\)/);
  });
});

describe("Customer-facing Lead → Booking cohort alignment", () => {
  it("getLeadCohortLifecycleBookingStats uses isBusinessFunnelCohortLead", () => {
    const lifecycleMetrics = readFileSync(resolve("lib/metrics/lifecycle-booking.ts"), "utf8");
    assert.match(lifecycleMetrics, /isBusinessFunnelCohortLead/);
    assert.match(lifecycleMetrics, /from \"@\/lib\/metrics\/cohort-population\"/);
    assert.match(lifecycleMetrics, /select\("id, acquisition_source, first_booked_at, sales_stage, status"\)/);
  });

  it("Overview Lead → Booking and Business Funnel share the approved population", () => {
    assert.match(overview, /Lost leads stay in this rate|later marked Lost/);
    assert.match(overview, /getLeadCohortLifecycleBookingStats/);
    assert.match(overview, /getBusinessFunnel/);
    const funnelSrc = readFileSync(resolve("lib/metrics/business-funnel.ts"), "utf8");
    assert.match(funnelSrc, /isBusinessFunnelCohortLead/);
    assert.match(funnelSrc, /from \"@\/lib\/metrics\/cohort-population\"/);
  });

  it("Sales cohort Lead → Booking uses the same helper (not a second population)", () => {
    assert.match(salesPage, /getLeadCohortLifecycleBookingStats/);
    assert.match(salesPage, /later marked Lost/);
  });
});

describe("Reporting distinctions", () => {
  it("Overview Bookings are lifecycle and do not expose Financially Committed", () => {
    assert.match(overview, /getLifecycleBookings/);
    assert.doesNotMatch(overview, /Financially Committed/);
    assert.doesNotMatch(overview, /getCanonicalBookings/);
    assert.match(overview, /getBusinessFunnel/);
    assert.match(overview, /BusinessFunnel/);
    assert.match(overview, /getUndatedLifecycleBookingCount/);
    assert.match(overview, /not have a known date/);
  });

  it("Bookings page is dated by first marked-booked and has no origin taxonomy", () => {
    assert.match(bookingsPage, /getLifecycleBookingsWithNames/);
    assert.match(bookingsPage, /Bookings by source/);
    assert.match(bookingsPage, /Unknown \/ Unattributed/);
    assert.doesNotMatch(bookingsPage, /Bookings by origin/);
    assert.doesNotMatch(bookingsPage, /Financially Committed/);
    assert.doesNotMatch(bookingsPage, /Coming later/);
    assert.doesNotMatch(bookingsPage, /lifecycle bookings in this period/);
  });

  it("Sales separates cohort vs period activity and shows attribution coverage", () => {
    assert.match(salesPage, /Cohort performance/);
    assert.match(salesPage, /Period activity/);
    assert.match(salesPage, /getLeadCohortLifecycleBookingStats/);
    assert.match(salesPage, /known acquisition source/);
    assert.match(salesPage, /Tours by source/);
    assert.match(salesPage, /Bookings by source/);
    assert.doesNotMatch(salesPage, /Financially Committed/);
    assert.doesNotMatch(salesPage, /lifecycle bookings in this period/);
  });

  it("Revenue copy is financial and does not name Booking as commitment", () => {
    assert.match(revenuePage, /Revenue by acquisition source/);
    assert.match(revenuePage, /not the same clock|mixed date clocks/);
    assert.doesNotMatch(revenuePage, /Financially Committed/);
  });

  it("Metric Registry still names the internal financial view", () => {
    assert.match(registry, /name: "Lifecycle Booking"/);
    assert.match(registry, /name: "Financially Committed"/);
    assert.match(registry, /write-once/);
    assert.match(registry, /Business Funnel/);
  });
});

describe("events.booked_at remains payment timing", () => {
  it("lifecycle recording does not call ensureEventBookedAt", () => {
    assert.doesNotMatch(lifecycleSvc, /ensureEventBookedAt/);
    assert.doesNotMatch(lifecycleSvc, /setEventBookedAt/);
  });

  it("active commitment still stamps events.booked_at only from bookedAt field", () => {
    assert.match(commitment, /if \(n\.bookedAt\?\.trim\(\)\)/);
    assert.match(commitment, /ensureEventBookedAt/);
    assert.match(commitment, /never treat this as lifecycle Booking/);
  });
});
