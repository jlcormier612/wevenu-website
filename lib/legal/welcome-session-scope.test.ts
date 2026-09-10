import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isVendorAppPath } from "@/lib/auth/session-scope";
import {
  isVendorReturnToPath,
  isWelcomeAppPath,
  portalMatchesSession,
  resolveWelcomeAuthScope,
  safeWelcomeReturnToPath,
  welcomeContextForScope,
  VENDOR_WELCOME_FALLBACK,
} from "@/lib/legal/welcome-session-scope";

describe("welcome-session-scope", () => {
  it("classifies the shared Welcome path", () => {
    assert.equal(isWelcomeAppPath("/welcome"), true);
    assert.equal(isWelcomeAppPath("/welcome/"), true);
    assert.equal(isWelcomeAppPath("/vendor/dashboard"), false);
  });

  it("detects vendor returnTo destinations", () => {
    assert.equal(isVendorReturnToPath("/vendor/dashboard"), true);
    assert.equal(
      isVendorReturnToPath("/vendor/events/abc?tab=messages"),
      true,
    );
    assert.equal(isVendorReturnToPath("/dashboard"), false);
    assert.equal(isVendorReturnToPath("/clients/1"), false);
    assert.equal(isVendorReturnToPath("//evil"), false);
  });

  it("resolves vendor-only and venue-only sessions", () => {
    assert.equal(
      resolveWelcomeAuthScope({
        hasVenueSession: false,
        hasVendorSession: true,
        returnTo: "/vendor/dashboard",
      }),
      "vendor",
    );
    assert.equal(
      resolveWelcomeAuthScope({
        hasVenueSession: true,
        hasVendorSession: false,
        returnTo: "/dashboard",
      }),
      "venue",
    );
    assert.equal(
      resolveWelcomeAuthScope({
        hasVenueSession: false,
        hasVendorSession: false,
      }),
      null,
    );
  });

  it("uses returnTo under /vendor when both cookies exist", () => {
    assert.equal(
      resolveWelcomeAuthScope({
        hasVenueSession: true,
        hasVendorSession: true,
        returnTo: "/vendor/events/x",
      }),
      "vendor",
    );
    assert.equal(
      resolveWelcomeAuthScope({
        hasVenueSession: true,
        hasVendorSession: true,
        returnTo: "/dashboard",
      }),
      "venue",
    );
    assert.equal(
      resolveWelcomeAuthScope({
        hasVenueSession: true,
        hasVendorSession: true,
        returnTo: "/clients/9",
      }),
      "venue",
    );
  });

  it("does not escalate to vendor from context alone (returnTo absent)", () => {
    // No returnTo + both sessions → venue (deterministic, no context input).
    assert.equal(
      resolveWelcomeAuthScope({
        hasVenueSession: true,
        hasVendorSession: true,
      }),
      "venue",
    );
  });

  it("sanitizes vendor returnTo away from venue app routes", () => {
    assert.equal(
      safeWelcomeReturnToPath("/dashboard", "vendor"),
      VENDOR_WELCOME_FALLBACK,
    );
    assert.equal(
      safeWelcomeReturnToPath("/clients/1", "vendor"),
      VENDOR_WELCOME_FALLBACK,
    );
    assert.equal(
      safeWelcomeReturnToPath("/events/1", "vendor"),
      VENDOR_WELCOME_FALLBACK,
    );
    assert.equal(
      safeWelcomeReturnToPath("/admin", "vendor"),
      VENDOR_WELCOME_FALLBACK,
    );
    assert.equal(
      safeWelcomeReturnToPath("/vendor/login", "vendor"),
      VENDOR_WELCOME_FALLBACK,
    );
    assert.equal(
      safeWelcomeReturnToPath("/vendor/events/abc?tab=tasks", "vendor"),
      "/vendor/events/abc?tab=tasks",
    );
  });

  it("preserves venue returnTo behavior", () => {
    assert.equal(
      safeWelcomeReturnToPath("/events/abc?tab=timeline", "venue"),
      "/events/abc?tab=timeline",
    );
    assert.equal(safeWelcomeReturnToPath("//evil", "venue"), "/dashboard");
  });

  it("ignores spoofed vendorInvitation context on venue scope", () => {
    assert.equal(
      welcomeContextForScope("venue", "vendorInvitation", "venueSignup"),
      "venueSignup",
    );
    assert.equal(
      welcomeContextForScope("vendor", "venueSignup", "vendorInvitation"),
      "vendorInvitation",
    );
    assert.equal(
      welcomeContextForScope("vendor", "vendorInvitation", "versionUpdate"),
      "vendorInvitation",
    );
  });

  it("requires matching session for portal gate", () => {
    assert.equal(
      portalMatchesSession("vendor", {
        hasVenueSession: true,
        hasVendorSession: false,
      }),
      false,
    );
    assert.equal(
      portalMatchesSession("venue", {
        hasVenueSession: false,
        hasVendorSession: true,
      }),
      false,
    );
    assert.equal(
      portalMatchesSession("vendor", {
        hasVenueSession: true,
        hasVendorSession: true,
      }),
      true,
    );
  });
});

describe("proxy welcome path classification alignment", () => {
  it("Welcome is not a vendor app path (uses shared route)", () => {
    assert.equal(isVendorAppPath("/welcome"), false);
    assert.equal(isWelcomeAppPath("/welcome"), true);
  });
});
