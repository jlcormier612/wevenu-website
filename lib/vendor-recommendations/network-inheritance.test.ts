import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isNetworkVendorEligibleForEventRecommendation,
  networkVendorIdsToSeed,
} from "@/lib/vendor-recommendations/network-inheritance";

describe("network vendor recommendation inheritance", () => {
  it("includes preferred, recommended, and approved (standard) active vendors", () => {
    assert.equal(
      isNetworkVendorEligibleForEventRecommendation({
        vendorId: "a",
        status: "active",
        preferenceLevel: "preferred",
      }),
      true,
    );
    assert.equal(
      isNetworkVendorEligibleForEventRecommendation({
        vendorId: "b",
        status: "invited",
        preferenceLevel: "recommended",
      }),
      true,
    );
    assert.equal(
      isNetworkVendorEligibleForEventRecommendation({
        vendorId: "c",
        status: "active",
        preferenceLevel: "standard",
      }),
      true,
    );
  });

  it("excludes inactive relationships", () => {
    assert.equal(
      isNetworkVendorEligibleForEventRecommendation({
        vendorId: "x",
        status: "inactive",
        preferenceLevel: "preferred",
      }),
      false,
    );
  });

  it("seeds the full eligible list only when the event has no recommendations yet", () => {
    const network = [
      { vendorId: "v1", status: "active", preferenceLevel: "preferred" },
      { vendorId: "v2", status: "active", preferenceLevel: "recommended" },
      { vendorId: "v3", status: "active", preferenceLevel: "standard" },
      { vendorId: "v4", status: "inactive", preferenceLevel: "preferred" },
    ];
    assert.deepEqual(networkVendorIdsToSeed(network, []), ["v1", "v2", "v3"]);
    // Exclusion sticks: existing rows mean do not re-seed (would restore deletes).
    assert.deepEqual(networkVendorIdsToSeed(network, ["v1"]), []);
  });

  it("does not treat is_required alone as eligibility — preference + availability do", () => {
    assert.equal(
      isNetworkVendorEligibleForEventRecommendation({
        vendorId: "req",
        status: "active",
        preferenceLevel: "standard",
        isRequired: true,
      }),
      true,
    );
  });
});
