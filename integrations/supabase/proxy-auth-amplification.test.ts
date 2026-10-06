/**
 * Regression tests for the 2026-09-28 Sandbox refresh storm.
 *
 * The proxy ran three network-validating `auth.getUser()` calls on every
 * matched request, before any public-path check. That put Supabase Auth in the
 * path of ALB health checks, couple-portal token polling, webhooks and cron
 * ticks, and let concurrent requests carrying one expired session all race the
 * same refresh token (Supabase 409 "Too many concurrent token refresh requests
 * on the same session or refresh token", then 429 over_request_rate_limit).
 *
 * These lock in the two structural guarantees that removed the amplification:
 * public routes resolve no session at all, and a scope with no cookie is never
 * asked about.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hasScopeSessionCookie, needsSessionResolution } from "./proxy.ts";

// Any ref works — cookie names are derived from it, so a neutral fixture keeps
// this test independent of which environment it happens to run against.
const REF = "projectref0000000000";

describe("public routes never reach Supabase Auth", () => {
  it("resolves no session for the traffic that dominated the storm", () => {
    // Every one of these was polled or probed on a fixed cadence and paid
    // three Auth round-trips per request before the repair.
    const unauthenticatedTraffic = [
      "/api/health",
      "/api/portal/notifications",
      "/api/portal/notifications/read",
      "/api/portal/notifications/clear",
      "/p/abc123",
      "/v/abc123",
      "/api/notifications/process",
      "/api/automation/process",
      "/api/facebook/sync/process",
      "/api/quickbooks/sync/process",
      "/api/webhooks/stripe-connect",
      "/api/messaging/inbound",
      "/sign/token",
      "/form/embed-key",
      "/book/embed-key",
      "/rsvp/guest-token",
      // Vendor portal APIs authenticate themselves (getVendorUser) rather than
      // relying on the proxy, so the bell polling them costs no Auth round-trip.
      "/api/vendor/notifications",
    ];

    for (const pathname of unauthenticatedTraffic) {
      assert.equal(
        needsSessionResolution(pathname),
        false,
        `${pathname} is public and must not cost a Supabase Auth round-trip`,
      );
    }
  });

  it("still resolves the session everywhere access is actually gated", () => {
    for (const pathname of [
      "/dashboard",
      "/leads",
      "/api/notifications",
      "/api/notifications/read",
      "/api/notifications/clear",
      "/vendor/dashboard",
      "/admin/venues",
      "/welcome",
      "/onboarding/intake",
    ]) {
      assert.equal(
        needsSessionResolution(pathname),
        true,
        `${pathname} is access-gated and must still resolve a session`,
      );
    }
  });

  it("keeps exact /login resolving so signed-in staff are bounced home", () => {
    // /login is public, but it is the one public route that reads the venue
    // session — skipping it would strand signed-in staff on the login screen.
    assert.equal(needsSessionResolution("/login"), true);
  });
});

describe("a scope with no cookie is never asked about", () => {
  const venueCookie = `sb-${REF}-auth-token`;
  const vendorCookie = `sb-${REF}-vendor-auth-token`;
  const clientCookie = `sb-${REF}-client-auth-token`;

  it("detects a present session per scope", () => {
    assert.equal(hasScopeSessionCookie([venueCookie], "venue", REF), true);
    assert.equal(hasScopeSessionCookie([vendorCookie], "vendor", REF), true);
    assert.equal(hasScopeSessionCookie([clientCookie], "client", REF), true);
  });

  it("skips scopes the request carries no cookie for", () => {
    // A signed-in staff request carries only the venue jar: the vendor and
    // client lookups were two of the three round-trips per request.
    const staffRequest = [venueCookie, "other-app-cookie"];
    assert.equal(hasScopeSessionCookie(staffRequest, "vendor", REF), false);
    assert.equal(hasScopeSessionCookie(staffRequest, "client", REF), false);

    assert.equal(hasScopeSessionCookie([], "venue", REF), false);
  });

  it("does not let one scope's cookie satisfy another", () => {
    // The vendor and client names both extend the venue prefix textually;
    // a loose prefix match here would resolve the wrong jar.
    assert.equal(hasScopeSessionCookie([vendorCookie], "venue", REF), false);
    assert.equal(hasScopeSessionCookie([clientCookie], "venue", REF), false);
    assert.equal(hasScopeSessionCookie([venueCookie], "vendor", REF), false);
    assert.equal(hasScopeSessionCookie([clientCookie], "vendor", REF), false);
  });

  it("recognises sessions @supabase/ssr split across cookie chunks", () => {
    // Large sessions land as `<name>.0`, `<name>.1`; missing these would read
    // a real session as absent and sign the user out.
    assert.equal(
      hasScopeSessionCookie([`${venueCookie}.0`, `${venueCookie}.1`], "venue", REF),
      true,
    );
    assert.equal(
      hasScopeSessionCookie([`${vendorCookie}.0`], "vendor", REF),
      true,
    );
  });

  it("falls back to asking Auth when the project ref cannot be derived", () => {
    // Fail safe, not fast: an unrecognised ref must not silently skip auth.
    assert.equal(hasScopeSessionCookie([], "venue", null), true);
  });
});
