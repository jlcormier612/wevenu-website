/**
 * Pure Vendor list presentation helpers — unit tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  vendorClaimStateLabel,
  vendorPreferenceBadgeKind,
  vendorPreferenceSortRank,
  venueRelationshipAvailableToClients,
  venueStaffCanManageRelationship,
} from "@/lib/vendors/list-presentation";
import type { VendorPreferenceLevel } from "@/lib/vendors/types";

describe("vendorPreferenceBadgeKind", () => {
  it("maps preferred and recommended; blank for standard", () => {
    assert.equal(vendorPreferenceBadgeKind("preferred"), "preferred");
    assert.equal(vendorPreferenceBadgeKind("recommended"), "recommended");
    assert.equal(vendorPreferenceBadgeKind("standard"), null);
  });

  it("maps legacy featured to preferred badge", () => {
    assert.equal(vendorPreferenceBadgeKind("featured"), "preferred");
  });
});

describe("vendorPreferenceSortRank", () => {
  it("orders preferred > recommended > standard", () => {
    assert.equal(vendorPreferenceSortRank("preferred"), 2);
    assert.equal(vendorPreferenceSortRank("recommended"), 1);
    assert.equal(vendorPreferenceSortRank("standard"), 0);
    const levels: VendorPreferenceLevel[] = ["standard", "preferred", "recommended"];
    const sorted = [...levels].sort(
      (a, b) => vendorPreferenceSortRank(b) - vendorPreferenceSortRank(a),
    );
    assert.deepEqual(sorted, ["preferred", "recommended", "standard"]);
  });
});

describe("vendorClaimStateLabel", () => {
  it("labels claim state for venue ops", () => {
    assert.equal(vendorClaimStateLabel(true), "Claimed");
    assert.equal(vendorClaimStateLabel(false), "Not claimed");
  });
});

describe("venueRelationshipAvailableToClients", () => {
  it("blocks inactive", () => {
    assert.equal(venueRelationshipAvailableToClients("inactive"), false);
    assert.equal(venueRelationshipAvailableToClients("active"), true);
    assert.equal(venueRelationshipAvailableToClients("invited"), true);
  });
});

describe("venueStaffCanManageRelationship", () => {
  it("requires matching venue", () => {
    assert.equal(venueStaffCanManageRelationship("v1", "v1"), true);
    assert.equal(venueStaffCanManageRelationship("v1", "v2"), false);
    assert.equal(venueStaffCanManageRelationship("v1", null), false);
  });
});
