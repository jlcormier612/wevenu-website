/**
 * NAV-PERF Wave 7A — single Suspense boundary + ensure* stay in deferred loader.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const page = readFileSync(resolve("app/(app)/clients/[id]/page.tsx"), "utf8");
const gate = readFileSync(resolve("app/(app)/clients/[id]/booked-identity-gate.tsx"), "utf8");
const detail = readFileSync(resolve("app/(app)/clients/[id]/booked-workspace-detail.tsx"), "utf8");
const fallback = readFileSync(resolve("components/clients/booking-identity-fallback.tsx"), "utf8");
const nameFallback = readFileSync(
  resolve("components/clients/booking-client-name-fallback.tsx"),
  "utf8",
);
const statusActions = readFileSync(
  resolve("components/clients/booking-identity-status-actions.tsx"),
  "utf8",
);
const timing = readFileSync(resolve("lib/shell/booking-first-byte-timing.ts"), "utf8");
const eventDetail = readFileSync(resolve("components/events/event-detail.tsx"), "utf8");

describe("NAV-PERF Wave 7A — booking streaming foundation", () => {
  it("page streams name shell first; gate owns celebration + event + detail Suspense", () => {
    assert.match(page, /BookedIdentityGate/);
    assert.match(page, /BookingClientNameFallback/);
    assert.match(page, /clients-detail-streaming-root/);
    assert.match(page, /identity_client_and_events/);
    assert.match(page, /withBookingFirstByteTiming/);
    assert.equal((page.match(/<Suspense/g) ?? []).length, 1);
    assert.equal((gate.match(/<Suspense/g) ?? []).length, 1);
    assert.match(gate, /BookedWorkspaceDetail/);
    assert.match(gate, /BookingIdentityFallback/);
    assert.match(gate, /identity_celebration_and_event/);
  });

  it("fallback exposes real identity actions without financial placeholders", () => {
    assert.match(fallback, /data-testid="booking-identity-fallback"/);
    assert.match(fallback, /BookingIdentityStatusActions/);
    assert.match(fallback, /data-testid="event-booking-summary"/);
    assert.match(fallback, /htc-hospitality-heading/);
    assert.doesNotMatch(fallback, /formatCurrency/);
    assert.doesNotMatch(fallback, /invoices\.length/);
    assert.doesNotMatch(fallback, /unbilledAmount|financialImpact/);
  });

  it("name-only fallback has no status actions (server still owns Cancel/Return)", () => {
    assert.match(nameFallback, /booking-client-name-fallback/);
    assert.match(nameFallback, /htc-hospitality-heading/);
    assert.doesNotMatch(nameFallback, /BookingIdentityStatusActions/);
    assert.doesNotMatch(nameFallback, /updateEventStatusAction/);
  });

  it("shell Cancel/Return reuse EventDetail eligibility and the same server actions", () => {
    assert.match(statusActions, /eventStatus !== "cancelled"/);
    assert.match(
      statusActions,
      /eventStatus === "cancelled" && !!bookedAt && !!clientId/,
    );
    assert.match(statusActions, /updateEventStatusAction/);
    assert.match(statusActions, /returnClientToBookedAction/);
    assert.match(statusActions, /PipelineBookedConfirmDialog/);
    assert.match(statusActions, /getBookingConfirmationDraftForClientAction/);
    assert.match(
      statusActions,
      /Cancel this event\? It leaves the active client list\. History, contracts, and payments stay\./,
    );
    // EventDetail keeps the same predicates (no rule rewrite).
    assert.match(eventDetail, /event\.status !== "cancelled"/);
    assert.match(
      eventDetail,
      /event\.status === "cancelled" && event\.bookedAt && event\.clientId/,
    );
  });

  it("deferred load failures preserve identity shell instead of a stuck Loading state", () => {
    assert.match(detail, /booking-workspace-detail-error/);
    assert.match(detail, /Couldn’t load the planning workspace/);
    assert.match(detail, /renderBookedWorkspaceDetail/);
  });

  it("ensure* remain in the deferred detail loader with timing only", () => {
    assert.match(detail, /ensureQuestionnaireFamilyForCurrentVenue/);
    assert.match(detail, /getOrEnsureEventRecommendations/);
    assert.match(detail, /bookingFbDeferredTime\("ensure_questionnaire_family_plus_templates"/);
    assert.match(detail, /bookingFbDeferredTime\("get_or_ensure_event_recommendations"/);
    assert.doesNotMatch(page, /ensureQuestionnaireFamilyForCurrentVenue/);
    assert.doesNotMatch(page, /getOrEnsureEventRecommendations/);
  });

  it("timing logs never include raw venue ids", () => {
    assert.match(timing, /venue_hash/);
    assert.doesNotMatch(timing, /venue_id:/);
    assert.match(timing, /booking_first_byte_timing/);
  });
});
