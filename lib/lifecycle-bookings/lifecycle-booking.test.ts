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
    assert.match(migration, /pipeline.*direct.*import/s);
  });

  it("does not redefine events.booked_at", () => {
    assert.doesNotMatch(migration, /alter table public\.events/);
    assert.match(migration, /Distinct from lifecycle Bookings/);
  });

  it("enriches sales_stage activity with previous stage", () => {
    assert.match(migration, /Previous stage:/);
  });
});

describe("Lifecycle booking writers", () => {
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

  it("Direct Add records origin=direct only for dated non-historical creates", () => {
    assert.match(clientsSvc, /origin: "direct"/);
    assert.match(clientsSvc, /!historicalImport && !asHistorical && eventId/);
    assert.match(clientsSvc, /markAsAlreadyBooked/);
    assert.match(clientsSvc, /origin: "import"/);
  });

  it("import lifecycle only when Mark as already booked", () => {
    assert.match(commitment, /if \(!n\.markAsAlreadyBooked\) return/);
    assert.match(commitment, /recordImportLifecycleIfMarked/);
    assert.match(commitment, /await recordImportLifecycleIfMarked\(\)/);
    assert.match(review, /Mark as already booked/);
    assert.match(review, /lifecycleBookedAt/);
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

describe("Reporting distinctions", () => {
  it("Overview Bookings use lifecycle; Financially Committed is separate", () => {
    assert.match(overview, /getLifecycleBookings/);
    assert.match(overview, /Financially Committed/);
    assert.match(overview, /getCanonicalBookings/);
    assert.match(overview, /Currently Booked on the sales pipeline/);
  });

  it("Bookings page is lifecycle-dated with origin breakdown", () => {
    assert.match(bookingsPage, /getLifecycleBookingsWithNames/);
    assert.match(bookingsPage, /Bookings by origin/);
    assert.match(bookingsPage, /Unknown \/ Unattributed/);
    assert.match(bookingsPage, /Financially Committed/);
  });

  it("Sales separates cohort vs period activity", () => {
    assert.match(salesPage, /Cohort performance/);
    assert.match(salesPage, /Period activity/);
    assert.match(salesPage, /getLeadCohortLifecycleBookingStats/);
    assert.match(salesPage, /Financially Committed/);
    assert.doesNotMatch(salesPage, /Signed contract \+ deposit collected/);
  });

  it("Revenue copy does not call financial proxy Booking", () => {
    assert.match(revenuePage, /Financially Committed/);
    assert.match(revenuePage, /Avg\. Committed Value/);
  });

  it("Metric Registry distinguishes Lifecycle Booking and Financially Committed", () => {
    assert.match(registry, /name: "Lifecycle Booking"/);
    assert.match(registry, /name: "Financially Committed"/);
    assert.match(registry, /write-once/);
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
