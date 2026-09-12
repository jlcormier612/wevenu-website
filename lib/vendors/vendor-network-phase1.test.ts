/**
 * Phase 1 Vendor Network — regression for inactive filter semantics and
 * check-in notification using business_name (not the removed vendors.name).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

import {
  venueRelationshipAvailableToClients,
  venueRelationshipEligibleForActiveVenue,
} from "@/lib/vendors/list-presentation";

describe("venue relationship availability (client directory / pick)", () => {
  it("allows invited and active", () => {
    assert.equal(venueRelationshipAvailableToClients("invited"), true);
    assert.equal(venueRelationshipAvailableToClients("active"), true);
  });

  it("blocks inactive from client directory and new picks", () => {
    assert.equal(venueRelationshipAvailableToClients("inactive"), false);
  });

  it("does not treat legacy removed as a live status (unknown → not available)", () => {
    assert.equal(venueRelationshipAvailableToClients("removed"), false);
  });
});

describe("venue relationship active-venue eligibility", () => {
  it("allows invited and active for immersion", () => {
    assert.equal(venueRelationshipEligibleForActiveVenue("invited"), true);
    assert.equal(venueRelationshipEligibleForActiveVenue("active"), true);
  });

  it("blocks inactive from active-venue hero", () => {
    assert.equal(venueRelationshipEligibleForActiveVenue("inactive"), false);
  });
});

describe("vendor check-in notification migration", () => {
  it("selects vendors.business_name and predicates use inactive not removed", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20261364000000_vendor_inactive_filter_and_checkin_notification.sql",
      ),
      "utf8",
    );
    // Executable bodies (ignore header comments that name the legacy bug).
    const bodies = sql.split("$$").filter((_, i) => i % 2 === 1).join("\n");
    assert.match(bodies, /select business_name into v_vendor_name/);
    assert.doesNotMatch(bodies, /select name into v_vendor_name/);
    assert.match(bodies, /vvr\.status <> 'inactive'/);
    assert.doesNotMatch(bodies, /status <> 'removed'/);
    assert.doesNotMatch(bodies, /status != 'removed'/);
  });
});
