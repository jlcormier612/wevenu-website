/**
 * Regression: multi-venue staff must not fall through to vendor on venue paths.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  mayFallThroughToVendorOnVenuePath,
  selectVenueStaffMembership,
} from "./resolve-venue-staff-membership";
import { evaluateLegalMiddleware } from "./welcome-middleware";

const ownerA = {
  venue_id: "venue-a",
  role: "owner",
  is_owner: true,
  is_active: true,
};
const managerB = {
  venue_id: "venue-b",
  role: "manager",
  is_owner: false,
  is_active: true,
};
const staffC = {
  venue_id: "venue-c",
  role: "staff",
  is_owner: false,
  is_active: true,
};

describe("selectVenueStaffMembership", () => {
  it("resolves a single-venue owner without venue context", () => {
    const result = selectVenueStaffMembership({ rows: [ownerA] });
    assert.equal(result.status, "resolved");
    if (result.status === "resolved") {
      assert.equal(result.row.venue_id, "venue-a");
      assert.equal(result.row.is_owner, true);
    }
  });

  it("resolves multi-venue owner/staff against active venue context", () => {
    const result = selectVenueStaffMembership({
      rows: [ownerA, managerB, staffC],
      activeVenueId: "venue-b",
    });
    assert.equal(result.status, "resolved");
    if (result.status === "resolved") {
      assert.equal(result.row.venue_id, "venue-b");
      assert.equal(result.row.role, "manager");
    }
  });

  it("resolves venue staff among multiple memberships by venue id", () => {
    const result = selectVenueStaffMembership({
      rows: [ownerA, staffC],
      activeVenueId: "venue-c",
    });
    assert.equal(result.status, "resolved");
    if (result.status === "resolved") {
      assert.equal(result.row.role, "staff");
    }
  });

  it("marks multi-row membership without venue context as ambiguous", () => {
    const result = selectVenueStaffMembership({
      rows: [ownerA, managerB],
    });
    assert.equal(result.status, "ambiguous");
    assert.equal(mayFallThroughToVendorOnVenuePath(result), false);
  });

  it("marks venue-context miss with other memberships as ambiguous", () => {
    const result = selectVenueStaffMembership({
      rows: [ownerA, managerB],
      activeVenueId: "venue-missing",
    });
    assert.equal(result.status, "ambiguous");
    assert.equal(mayFallThroughToVendorOnVenuePath(result), false);
  });

  it("returns none for zero memberships (vendor fallthrough allowed)", () => {
    const result = selectVenueStaffMembership({ rows: [] });
    assert.equal(result.status, "none");
    assert.equal(mayFallThroughToVendorOnVenuePath(result), true);
  });

  it("returns error for query failures and blocks vendor fallthrough", () => {
    const result = selectVenueStaffMembership({
      rows: null,
      error: { code: "PGRST116", message: "multiple rows returned" },
    });
    assert.equal(result.status, "error");
    assert.equal(mayFallThroughToVendorOnVenuePath(result), false);
  });

  it("ignores inactive rows when selecting", () => {
    const result = selectVenueStaffMembership({
      rows: [
        { ...ownerA, is_active: false },
        managerB,
      ],
    });
    assert.equal(result.status, "resolved");
    if (result.status === "resolved") {
      assert.equal(result.row.venue_id, "venue-b");
    }
  });
});

describe("venue-path principal fallthrough policy", () => {
  it("does not allow vendor fallthrough on ambiguous or error", () => {
    assert.equal(
      mayFallThroughToVendorOnVenuePath({ status: "ambiguous" }),
      false,
    );
    assert.equal(
      mayFallThroughToVendorOnVenuePath({
        status: "error",
        message: "boom",
      }),
      false,
    );
    assert.equal(
      mayFallThroughToVendorOnVenuePath({ status: "none" }),
      true,
    );
  });

  it("direct venue route still redirects when acceptance is required", () => {
    const decision = evaluateLegalMiddleware({
      pathname: "/dashboard",
      search: "",
      requiresAcceptance: true,
      context: "versionUpdate",
    });
    assert.equal(decision.action, "redirect_welcome");
    if (decision.action === "redirect_welcome") {
      assert.match(decision.welcomePath, /^\/welcome\?/);
      assert.match(decision.welcomePath, /returnTo=%2Fdashboard/);
    }
  });

  it("direct venue route allows when acceptance is current", () => {
    const decision = evaluateLegalMiddleware({
      pathname: "/clients",
      search: "",
      requiresAcceptance: false,
      context: "versionUpdate",
    });
    assert.equal(decision.action, "allow");
  });
});

describe("legal principal resolution source contracts", () => {
  it("stops using unscoped venue_staff maybeSingle in principal resolvers", () => {
    const principal = readFileSync(
      resolve("lib/legal/resolve-session-principal.ts"),
      "utf8",
    );
    const proxyHelper = readFileSync(
      resolve("lib/legal/enforce-legal-in-proxy.ts"),
      "utf8",
    );
    const proxy = readFileSync(
      resolve("integrations/supabase/proxy.ts"),
      "utf8",
    );

    assert.match(principal, /selectVenueStaffMembership/);
    assert.match(proxyHelper, /selectVenueStaffMembership/);
    assert.match(proxyHelper, /activeVenueId/);
    assert.match(proxy, /htc_active_venue_id/);
    assert.match(proxy, /activeVenueId/);

    assert.doesNotMatch(
      principal,
      /\.from\("venue_staff"\)[\s\S]{0,200}\.maybeSingle/,
    );
    assert.doesNotMatch(
      proxyHelper,
      /\.from\("venue_staff"\)[\s\S]{0,200}\.maybeSingle/,
    );
  });
});
