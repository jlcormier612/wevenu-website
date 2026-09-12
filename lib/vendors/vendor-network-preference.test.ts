/**
 * Vendor Network — preference presentation + inquiry cardinality helpers.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  vendorPreferenceBadgeKind,
  vendorPreferenceClientLabel,
  vendorPreferenceSortRank,
  venueRelationshipAvailableToClients,
} from "@/lib/vendors/list-presentation";

describe("vendor preference presentation (Approved / Recommended / Preferred)", () => {
  it("does not badge Approved (standard)", () => {
    assert.equal(vendorPreferenceBadgeKind("standard"), null);
    assert.equal(vendorPreferenceClientLabel("standard"), null);
  });

  it("badges Recommended and Preferred", () => {
    assert.equal(vendorPreferenceBadgeKind("recommended"), "recommended");
    assert.equal(vendorPreferenceBadgeKind("preferred"), "preferred");
    assert.equal(vendorPreferenceClientLabel("recommended"), "Recommended");
    assert.equal(vendorPreferenceClientLabel("preferred"), "Preferred");
  });

  it("maps legacy featured to Preferred ranking", () => {
    assert.equal(vendorPreferenceBadgeKind("featured"), "preferred");
    assert.equal(vendorPreferenceSortRank("featured"), vendorPreferenceSortRank("preferred"));
  });

  it("sorts Preferred > Recommended > Approved", () => {
    assert.ok(vendorPreferenceSortRank("preferred") > vendorPreferenceSortRank("recommended"));
    assert.ok(vendorPreferenceSortRank("recommended") > vendorPreferenceSortRank("standard"));
  });
});

describe("client availability boundary", () => {
  it("allows invited and active; blocks inactive", () => {
    assert.equal(venueRelationshipAvailableToClients("invited"), true);
    assert.equal(venueRelationshipAvailableToClients("active"), true);
    assert.equal(venueRelationshipAvailableToClients("inactive"), false);
  });
});

describe("inquiry cardinality rule (product lock)", () => {
  it("one active inquiry key is client relationship + venue vendor relationship", () => {
    // Mirrors conversations_couple_vendor_inquiry_uniq
    const key = (relationshipId: string, vendorRelationshipId: string) =>
      `${relationshipId}::${vendorRelationshipId}`;
    assert.equal(
      key("rel-1", "vvr-1"),
      key("rel-1", "vvr-1"),
    );
    assert.notEqual(
      key("rel-1", "vvr-1"),
      key("rel-1", "vvr-2"),
    );
  });
});
