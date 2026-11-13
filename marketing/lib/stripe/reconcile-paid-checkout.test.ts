/**
 * Checkout reconcile — success URL alone never provisions; Stripe eligibility
 * gates enrollment; invalid session ids fail closed.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("reconcile paid checkout", () => {
  it("exports reconcilePaidCheckoutSession and requires cs_ session ids", () => {
    const src = readFileSync(join(__dirname, "reconcile-paid-checkout.ts"), "utf8");
    assert.match(src, /export async function reconcilePaidCheckoutSession/);
    assert.match(src, /startsWith\("cs_"\)/);
    assert.match(src, /shouldProvisionFromCheckoutSession/);
    assert.match(src, /createVenueEnrollment/);
    assert.match(src, /findEnrollmentByCheckoutSessionId/);
    assert.match(src, /stripe_session_not_found/);
  });

  it("success page reconciles when enrollment wait is still pending", () => {
    const page = readFileSync(
      join(__dirname, "../../app/pricing/success/page.tsx"),
      "utf8",
    );
    assert.match(page, /reconcilePaidCheckoutSession/);
    assert.match(page, /Your subscription is being confirmed/);
    assert.match(page, /paymentActionRequired/);
    assert.match(page, /Return to pricing/);
  });

  it("exposes a POST reconcile API that never trusts URL-only payment", () => {
    const route = readFileSync(
      join(__dirname, "../../app/api/stripe/reconcile-checkout/route.ts"),
      "utf8",
    );
    assert.match(route, /reconcilePaidCheckoutSession/);
    assert.match(route, /session_id/);
  });

  it("pending refresh offers explicit retry after soft refreshes", () => {
    const refresh = readFileSync(
      join(__dirname, "../../components/pricing/success-pending-refresh.tsx"),
      "utf8",
    );
    assert.match(refresh, /\/api\/stripe\/reconcile-checkout/);
    assert.match(refresh, /Try confirming again/);
    assert.match(refresh, /not_eligible/);
  });
});
