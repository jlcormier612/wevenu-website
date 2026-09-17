import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  canRefundEventPayment,
  canRefundTourFee,
  isConnectEligible,
  isTourProtectionMetadata,
  isTourProtectionRequired,
  tourProtectionKind,
  webhookVenueMatchesRequest,
} from "@/lib/tours/protection-rules";

const SETTINGS = "supabase/migrations/20261399500000_tour_protection_venue_settings.sql";
const REQUESTS = "supabase/migrations/20261399600000_tour_protection_requests.sql";
const APPTS = "supabase/migrations/20261399700000_tour_appointments_protection_state.sql";
const BOOK = "supabase/migrations/20261399800000_book_protected_tour.sql";
const GRANTS = "supabase/migrations/20261399900000_tour_protection_service_role_grants.sql";
const ATOMICITY = "supabase/migrations/20261322000000_tour_booking_atomicity.sql";
const WEBHOOK_ROUTE = "app/api/webhooks/stripe-connect/route.ts";
const WEBHOOK_HANDLERS = "lib/stripe/webhook-handlers.ts";
const BOOK_SERVICE = "lib/tours/service.ts";
const BOOK_ROUTE = "app/api/tours/book/route.ts";
const CHECKOUT = "lib/tours/protection-checkout.ts";
const INQUIRY = "components/form/inquiry-form.tsx";
const PAYMENTS = "lib/payments/service.ts";
const METRICS_FUNNEL = "lib/metrics/business-funnel.ts";

function read(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

describe("Tour protection venue eligibility", () => {
  it("requires stripe_account_id and stripe_charges_enabled, not a new flag", () => {
    assert.equal(isConnectEligible({ stripeAccountId: null, stripeChargesEnabled: true }), false);
    assert.equal(isConnectEligible({ stripeAccountId: "acct_1", stripeChargesEnabled: false }), false);
    assert.equal(isConnectEligible({ stripeAccountId: "acct_1", stripeChargesEnabled: true }), true);
  });

  it("does not require protection when mode is none or Connect is ineligible", () => {
    const base = { tourProtectionFeeCents: 5000, stripeAccountId: "acct_1", stripeChargesEnabled: true };
    assert.equal(isTourProtectionRequired({ ...base, tourProtectionMode: "none" }), false);
    assert.equal(isTourProtectionRequired({
      tourProtectionMode: "setup",
      tourProtectionFeeCents: 0,
      stripeAccountId: null,
      stripeChargesEnabled: true,
    }), false);
    assert.equal(isTourProtectionRequired({ ...base, tourProtectionMode: "setup" }), true);
    assert.equal(isTourProtectionRequired({ ...base, tourProtectionMode: "fee" }), true);
    assert.equal(isTourProtectionRequired({ ...base, tourProtectionMode: "fee", tourProtectionFeeCents: 0 }), false);
  });

  it("exposes setup vs fee without Stripe jargon", () => {
    const eligible = { stripeAccountId: "acct_1", stripeChargesEnabled: true, tourProtectionFeeCents: 2500 };
    assert.equal(tourProtectionKind({ ...eligible, tourProtectionMode: "setup" }), "setup");
    assert.equal(tourProtectionKind({ ...eligible, tourProtectionMode: "fee" }), "fee");
    assert.equal(tourProtectionKind({ ...eligible, tourProtectionMode: "none" }), null);
  });
});

describe("Tour protection webhook authority", () => {
  it("routes on htc_kind or htc_tour_protection_request_id", () => {
    assert.equal(isTourProtectionMetadata({ htc_kind: "tour_protection" }), true);
    assert.equal(isTourProtectionMetadata({ htc_tour_protection_request_id: "req" }), true);
    assert.equal(isTourProtectionMetadata({ htc_kind: "event" }), false);
    assert.equal(isTourProtectionMetadata({}), false);
  });

  it("rejects foreign connected accounts and mismatched metadata venue ids", () => {
    assert.equal(webhookVenueMatchesRequest({
      requestVenueId: "v1",
      connectedAccountVenueId: "v1",
      metadataVenueId: "v1",
    }), true);
    assert.equal(webhookVenueMatchesRequest({
      requestVenueId: "v1",
      connectedAccountVenueId: "v2",
      metadataVenueId: "v1",
    }), false);
    assert.equal(webhookVenueMatchesRequest({
      requestVenueId: "v1",
      connectedAccountVenueId: null,
      metadataVenueId: "v1",
    }), false);
    assert.equal(webhookVenueMatchesRequest({
      requestVenueId: "v1",
      connectedAccountVenueId: "v1",
      metadataVenueId: "v2",
    }), false);
  });
});

describe("Tour protection refund permissions", () => {
  it("allows Owner and Manager for tour fees, Owner only for event payments", () => {
    assert.equal(canRefundTourFee("owner"), true);
    assert.equal(canRefundTourFee("manager"), true);
    assert.equal(canRefundTourFee("staff"), false);
    assert.equal(canRefundEventPayment("owner"), true);
    assert.equal(canRefundEventPayment("manager"), false);
    const payments = read(PAYMENTS);
    assert.match(payments, /Only the venue Owner can issue a refund/);
    assert.match(payments, /role !== "owner"/);
  });
});

describe("Tour protection migrations", () => {
  const settings = read(SETTINGS);
  const requests = read(REQUESTS);
  const appts = read(APPTS);
  const book = read(BOOK);

  it("adds venue protection settings without a second settings system or new eligibility flag", () => {
    assert.match(settings, /tour_protection_mode/);
    assert.match(settings, /'none', 'setup', 'fee'/);
    assert.match(settings, /tour_protection_fee_cents/);
    assert.doesNotMatch(settings, /tour_protection_enabled/);
    assert.match(settings, /stripe_account_id is not null/);
    assert.match(settings, /stripe_charges_enabled/);
  });

  it("stages requests keyed by Stripe session id with RLS venue isolation", () => {
    assert.match(requests, /create table public\.tour_protection_requests/);
    assert.match(requests, /stripe_checkout_session_id text/);
    assert.match(requests, /tour_protection_requests_session_id/);
    assert.match(requests, /enable row level security/);
    assert.match(requests, /current_user_venue_id\(\)/);
    assert.match(requests, /'paid_unbooked'/);
    assert.match(requests, /'abandoned'/);
    assert.doesNotMatch(requests, /grant .* to anon/);
    assert.doesNotMatch(requests, /grant .* to service_role/);
  });

  it("grants service_role insert/select/update so webhooks can stage and complete requests", () => {
    const grants = read(GRANTS);
    assert.match(grants, /grant select, insert, update on public\.tour_protection_requests to service_role/);
    assert.doesNotMatch(grants, /grant .* to anon/);
  });

  it("associates appointments without adding payment columns", () => {
    assert.match(appts, /protection_request_id/);
    assert.doesNotMatch(appts, /stripe_payment_intent_id/);
    assert.doesNotMatch(appts, /stripe_customer_id/);
    assert.match(appts, /Not a payment column/);
  });

  it("books protected tours with occupancy + calendar-blocks locks and paid_unbooked late success", () => {
    const fnAt = book.indexOf("create or replace function public.book_protected_tour");
    const fn = book.slice(fnAt, book.indexOf("create or replace function public.book_tour("));
    assert.match(fn, /lock_tour_occupancy_interval/);
    assert.match(fn, /hashtext\('calendar-blocks'\)/);
    assert.match(fn, /paid_unbooked/);
    assert.match(fn, /for update/);
    assert.match(fn, /idempotent/);
    assert.match(fn, /protection_request_id/);
    assert.doesNotMatch(fn, /ingest_lead/);
    assert.match(book, /grant execute on function public\.book_protected_tour\(uuid\) to service_role/);
    assert.match(book, /revoke all on function public\.book_protected_tour\(uuid\) from public, anon, authenticated/);
  });

  it("blocks the public book_tour RPC when eligible protection is required", () => {
    const bookAt = book.indexOf("create or replace function public.book_tour(");
    const publicBook = book.slice(bookAt);
    assert.match(publicBook, /protection_required/);
    assert.match(publicBook, /lock_tour_occupancy_interval/);
    assert.match(publicBook, /hashtext\('calendar-blocks'\)/);
    assert.match(publicBook, /when raise_exception then/);
  });
});

describe("Normal tour path is preserved", () => {
  it("bookTour still calls book_tour when protection is not required", () => {
    const service = read(BOOK_SERVICE);
    assert.match(service, /venueRequiresPublicProtection/);
    assert.match(service, /startProtectedTour/);
    assert.match(service, /admin\.rpc\("book_tour"/);
  });

  it("staff book_tour_for_lead is unchanged and has no Stripe gate", () => {
    const atomicity = read(ATOMICITY);
    const book = read(BOOK);
    assert.match(atomicity, /create or replace function public\.book_tour_for_lead/);
    assert.doesNotMatch(book, /create or replace function public\.book_tour_for_lead/);
    const staff = atomicity.slice(atomicity.indexOf("create or replace function public.book_tour_for_lead"));
    assert.doesNotMatch(staff, /tour_protection/);
    assert.doesNotMatch(staff, /stripe_/);
    assert.match(staff, /current_user_venue_id\(\)/);
  });

  it("reschedule updates the same appointment and does not insert a protection request", () => {
    const atomicity = read(ATOMICITY);
    const reschedule = atomicity.slice(atomicity.indexOf("create or replace function public.reschedule_tour"));
    assert.match(reschedule, /update public\.tour_appointments/);
    assert.doesNotMatch(reschedule, /insert into public\.tour_appointments/);
    assert.doesNotMatch(reschedule, /tour_protection_requests/);
  });
});

describe("Protected tour application seams", () => {
  it("Checkout session is created on the connected account with htc_payment_line_item_id routing", () => {
    const checkout = read(CHECKOUT);
    assert.match(checkout, /htc_payment_line_item_id: input\.requestId/);
    assert.match(checkout, /htc_kind: TOUR_PROTECTION_KIND/);
    assert.match(checkout, /mode: "setup"/);
    assert.match(checkout, /mode: "payment"/);
    assert.match(checkout, /stripeAccount: input\.stripeAccountId/);
    assert.doesNotMatch(checkout, /payment_line_items/);
    assert.doesNotMatch(checkout, /createPortalCheckoutSession/);
  });

  it("webhook branch runs checkout.session.completed before generic event-payment handling", () => {
    const route = read(WEBHOOK_ROUTE);
    const handlers = read(WEBHOOK_HANDLERS);
    assert.match(route, /checkout\.session\.completed/);
    assert.match(route, /checkout\.session\.expired/);
    assert.match(handlers, /completeProtectedTourFromWebhook/);
    const succeededAt = handlers.indexOf("export async function handlePaymentIntentSucceeded");
    const genericAt = handlers.indexOf("markItemPaidFromStripe");
    const tourAt = handlers.indexOf("completeProtectedTourFromWebhook", succeededAt);
    assert.ok(tourAt > 0 && tourAt < genericAt, "tour protection must run before markItemPaidFromStripe");
  });

  it("public book route does not treat a checkout URL as a booked appointment", () => {
    const route = read(BOOK_ROUTE);
    assert.match(route, /result\.ok && result\.appointmentId/);
    assert.match(route, /runTourBookedSideEffects/);
  });

  it("public form does not claim the tour is booked before success, and distinguishes the payment step", () => {
    const form = read(INQUIRY);
    assert.match(form, /data\.ok && data\.checkoutUrl/);
    assert.match(form, /Your tour is not booked yet/);
    assert.match(form, /A tour fee is required before this tour is booked/);
    assert.match(form, /A card on file is required before this tour is booked/);
    assert.match(form, /Continue to payment/);
    assert.match(form, /Continue to save a card/);
  });

  it("does not represent tour fees as event invoices or collected/outstanding reporting", () => {
    const checkout = read(CHECKOUT);
    const funnel = read(METRICS_FUNNEL);
    assert.match(checkout, /Venue tour fee/);
    assert.doesNotMatch(checkout, /from\("invoices"\)|payment_schedules|payment_line_items/);
    assert.doesNotMatch(funnel, /tour_protection_requests/);
  });
});
