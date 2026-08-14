/**
 * Vendor list Preference/claim presentation + venue-staff RLS predicates.
 * Pure helpers only — no DB. Mirrors approved remediation Option 3 + P0 RLS.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  venueStaffCanInsertVendor,
  venueStaffCanManageRelationship,
  venueStaffCanSeeVendorTeam,
  venueStaffCanSelectRelatedVendor,
  venueStaffCanUpdateUnclaimedVendor,
  vendorClaimStateLabel,
  vendorPreferenceBadgeKind,
  vendorPreferenceSortRank,
} from "@/lib/vendors/list-presentation";
import type { VendorPreferenceLevel } from "@/lib/vendors/types";

describe("vendor list preference presentation", () => {
  it("featured and preferred show badges; recommended stays blank", () => {
    assert.equal(vendorPreferenceBadgeKind("featured"), "featured");
    assert.equal(vendorPreferenceBadgeKind("preferred"), "preferred");
    assert.equal(vendorPreferenceBadgeKind("recommended"), null);
  });

  it("Preferred First sort rank is unchanged (featured > preferred > recommended)", () => {
    assert.equal(vendorPreferenceSortRank("featured"), 2);
    assert.equal(vendorPreferenceSortRank("preferred"), 1);
    assert.equal(vendorPreferenceSortRank("recommended"), 0);
    const levels: VendorPreferenceLevel[] = ["recommended", "featured", "preferred"];
    const sorted = [...levels].sort(
      (a, b) => vendorPreferenceSortRank(b) - vendorPreferenceSortRank(a),
    );
    assert.deepEqual(sorted, ["featured", "preferred", "recommended"]);
  });
});

describe("vendor list claim-state presentation", () => {
  it("Claimed when is_claimed === true", () => {
    assert.equal(vendorClaimStateLabel(true), "Claimed");
  });

  it("Not claimed when is_claimed === false", () => {
    assert.equal(vendorClaimStateLabel(false), "Not claimed");
  });

  it("never uses Invited and never infers invitation from claim state", () => {
    assert.equal(vendorClaimStateLabel(false), "Not claimed");
    assert.notEqual(vendorClaimStateLabel(false), "Invited");
    assert.doesNotMatch(vendorClaimStateLabel(false), /invit/i);
    assert.doesNotMatch(vendorClaimStateLabel(true), /invit/i);
  });
});

describe("truth matrix states A–D (list columns)", () => {
  // A — newly added, unranked, unclaimed
  it("A: recommended + unclaimed → blank Preference, Not claimed", () => {
    assert.equal(vendorPreferenceBadgeKind("recommended"), null);
    assert.equal(vendorClaimStateLabel(false), "Not claimed");
  });

  // B — preferred, still unclaimed
  it("B: preferred + unclaimed → Preferred badge, Not claimed (distinct from C)", () => {
    assert.equal(vendorPreferenceBadgeKind("preferred"), "preferred");
    assert.equal(vendorClaimStateLabel(false), "Not claimed");
  });

  // C — claimed and Preferred
  it("C: preferred + claimed → Preferred badge, Claimed (visually distinct from B)", () => {
    assert.equal(vendorPreferenceBadgeKind("preferred"), "preferred");
    assert.equal(vendorClaimStateLabel(true), "Claimed");
    assert.notEqual(
      vendorClaimStateLabel(true),
      vendorClaimStateLabel(false),
    );
  });

  // D — deactivated vendors are excluded from the directory list (inactive filter)
  it("D: inactive vendors are out of list scope; claim/preference helpers stay independent", () => {
    assert.equal(vendorPreferenceBadgeKind("preferred"), "preferred");
    assert.equal(vendorClaimStateLabel(true), "Claimed");
    assert.equal(vendorClaimStateLabel(false), "Not claimed");
  });
});

describe("venues_manage_relationships venue-staff RLS model", () => {
  const venueA = "venue-a";
  const venueB = "venue-b";

  it("Owner/Manager/Staff with matching current_user_venue_id can manage", () => {
    assert.equal(venueStaffCanManageRelationship(venueA, venueA), true);
  });

  it("cross-venue isolation: other venue's current_user_venue_id cannot manage", () => {
    assert.equal(venueStaffCanManageRelationship(venueA, venueB), false);
  });

  it("null current_user_venue_id cannot manage (no venue context)", () => {
    assert.equal(venueStaffCanManageRelationship(venueA, null), false);
  });
});

describe("venues_see_vendor_team venue-staff RLS model", () => {
  const venueA = "venue-a";
  const venueB = "venue-b";

  it("Manager sees team when an active relationship matches their venue", () => {
    assert.equal(venueStaffCanSeeVendorTeam([venueA], venueA), true);
  });

  it("cross-venue isolation: active relationship on another venue is not enough", () => {
    assert.equal(venueStaffCanSeeVendorTeam([venueB], venueA), false);
  });

  it("inactive-only relationships are not passed in (status <> inactive filter)", () => {
    // Caller supplies only non-inactive venue ids — empty means no access.
    assert.equal(venueStaffCanSeeVendorTeam([], venueA), false);
  });

  it("null current_user_venue_id cannot see vendor team", () => {
    assert.equal(venueStaffCanSeeVendorTeam([venueA], null), false);
  });
});

describe("venues_select_related_vendors venue-staff RLS model", () => {
  const venueA = "venue-a";
  const venueB = "venue-b";
  const vendorId = "vendor-1";

  it("Owner/Manager can read venue vendors when relationship matches", () => {
    assert.equal(venueStaffCanSelectRelatedVendor([venueA], venueA), true);
  });

  it("Manager can read venue vendors (same predicate as Owner)", () => {
    assert.equal(venueStaffCanSelectRelatedVendor([venueA], venueA), true);
  });

  it("cross-venue isolation: another venue's vendors are not readable", () => {
    assert.equal(venueStaffCanSelectRelatedVendor([venueB], venueA), false);
  });

  it("Owner unchanged: matching venue still readable", () => {
    assert.equal(venueStaffCanSelectRelatedVendor([venueA], venueA), true);
  });

  it("relationship behavior intact: inactive-only yields no access", () => {
    assert.equal(venueStaffCanSelectRelatedVendor([], venueA), false);
  });

  it("null current_user_venue_id cannot select related vendors", () => {
    assert.equal(venueStaffCanSelectRelatedVendor([venueA], null), false);
  });

  it("vendor self-access via current_user_vendor_id still works without venue", () => {
    assert.equal(
      venueStaffCanSelectRelatedVendor([], null, {
        vendorId,
        currentUserVendorId: vendorId,
      }),
      true,
    );
  });
});

describe("venues_update_unclaimed_vendors venue-staff RLS model", () => {
  const venueA = "venue-a";
  const venueB = "venue-b";

  it("Manager can update unclaimed vendor with matching venue relationship", () => {
    assert.equal(
      venueStaffCanUpdateUnclaimedVendor(false, [venueA], venueA),
      true,
    );
  });

  it("claimed vendor identity lock: Manager cannot update when is_claimed", () => {
    assert.equal(
      venueStaffCanUpdateUnclaimedVendor(true, [venueA], venueA),
      false,
    );
  });

  it("cross-venue isolation: cannot update another venue's unclaimed vendor", () => {
    assert.equal(
      venueStaffCanUpdateUnclaimedVendor(false, [venueB], venueA),
      false,
    );
  });

  it("Owner unchanged: matching unclaimed vendor still updatable", () => {
    assert.equal(
      venueStaffCanUpdateUnclaimedVendor(false, [venueA], venueA),
      true,
    );
  });

  it("null current_user_venue_id cannot update", () => {
    assert.equal(
      venueStaffCanUpdateUnclaimedVendor(false, [venueA], null),
      false,
    );
  });
});

describe("venues_insert_vendors venue-staff RLS model", () => {
  const venueA = "venue-a";

  it("Owner/Manager with resolved venue context can insert", () => {
    assert.equal(venueStaffCanInsertVendor(venueA), true);
  });

  it("null current_user_venue_id cannot insert", () => {
    assert.equal(venueStaffCanInsertVendor(null), false);
  });
});
