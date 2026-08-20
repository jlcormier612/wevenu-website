import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  countPortalRoles,
  loginRedirectWithNext,
  pickAuthenticatedHomePath,
  safeInternalNextPath,
} from "@/lib/auth/portal-home";

describe("safeInternalNextPath", () => {
  it("allows same-origin relative paths", () => {
    assert.equal(safeInternalNextPath("/vendor/dashboard"), "/vendor/dashboard");
    assert.equal(
      safeInternalNextPath("/vendor/accept?token=abc"),
      "/vendor/accept?token=abc",
    );
  });

  it("rejects open redirects and login loops", () => {
    assert.equal(safeInternalNextPath("//evil.com"), null);
    assert.equal(safeInternalNextPath("https://evil.com"), null);
    assert.equal(safeInternalNextPath("/login"), null);
    assert.equal(safeInternalNextPath("/workspaces"), null);
  });
});

describe("pickAuthenticatedHomePath", () => {
  it("honors safe next over role defaults", () => {
    assert.equal(
      pickAuthenticatedHomePath({
        next: "/vendor/accept?token=x",
        roles: { isVendor: false, clientPortalPath: null, isVenueStaff: true },
      }),
      "/vendor/accept?token=x",
    );
  });

  it("sends vendor-only identities to the vendor portal", () => {
    assert.equal(
      pickAuthenticatedHomePath({
        roles: { isVendor: true, clientPortalPath: null, isVenueStaff: false },
      }),
      "/vendor/dashboard",
    );
  });

  it("sends client-only identities to their portal token URL", () => {
    assert.equal(
      pickAuthenticatedHomePath({
        roles: {
          isVendor: false,
          clientPortalPath: "/p/tok-1",
          isVenueStaff: false,
        },
      }),
      "/p/tok-1",
    );
  });

  it("sends venue-only identities to the venue dashboard", () => {
    assert.equal(
      pickAuthenticatedHomePath({
        roles: { isVendor: false, clientPortalPath: null, isVenueStaff: true },
      }),
      "/dashboard",
    );
  });

  it("does not silently prefer venue when multiple portals exist", () => {
    assert.equal(
      pickAuthenticatedHomePath({
        roles: {
          isVendor: true,
          clientPortalPath: "/p/tok",
          isVenueStaff: true,
        },
      }),
      "/workspaces",
    );
  });

  it("honors prefer when that portal is available", () => {
    assert.equal(
      pickAuthenticatedHomePath({
        prefer: "venue",
        roles: {
          isVendor: true,
          clientPortalPath: null,
          isVenueStaff: true,
        },
      }),
      "/dashboard",
    );
    assert.equal(
      pickAuthenticatedHomePath({
        prefer: "vendor",
        roles: {
          isVendor: true,
          clientPortalPath: null,
          isVenueStaff: true,
        },
      }),
      "/vendor/dashboard",
    );
  });

  it("sends unlinked identities to venue setup", () => {
    assert.equal(
      pickAuthenticatedHomePath({
        roles: { isVendor: false, clientPortalPath: null, isVenueStaff: false },
      }),
      "/setup",
    );
  });
});

describe("loginRedirectWithNext", () => {
  it("preserves vendor deep links after sign-in", () => {
    assert.equal(
      loginRedirectWithNext("/vendor/dashboard", ""),
      "/login?next=%2Fvendor%2Fdashboard",
    );
  });

  it("does not nest login or API paths as next", () => {
    assert.equal(loginRedirectWithNext("/login", ""), "/login");
    assert.equal(loginRedirectWithNext("/api/health", ""), "/login");
  });
});

describe("countPortalRoles", () => {
  it("counts distinct portal kinds", () => {
    assert.equal(
      countPortalRoles({
        isVendor: true,
        clientPortalPath: "/p/x",
        isVenueStaff: true,
      }),
      3,
    );
  });
});
