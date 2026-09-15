import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isFeedbackPubliclyEligible,
  mapPeFamilyToCoupleVenueFeedback,
} from "./couple-venue-feedback";

describe("mapPeFamilyToCoupleVenueFeedback", () => {
  it("maps PE questionnaire answers into couple_venue_feedback fields", () => {
    const mapped = mapPeFamilyToCoupleVenueFeedback({
      team_rating: "5",
      venue_rating: "4",
      did_well: "Everything felt personal",
      could_improve: "Parking signs",
      recommend: "yes",
      share_review: "yes",
    });

    assert.ok(mapped);
    assert.equal(mapped!.overallRating, 5);
    assert.equal(mapped!.lovedMost, "Everything felt personal");
    assert.equal(mapped!.couldImprove, "Parking signs");
    assert.equal(mapped!.wouldRecommend, true);
    assert.equal(mapped!.publicPermission, "review_and_names");
  });

  it("keeps feedback private when share_review is no", () => {
    const mapped = mapPeFamilyToCoupleVenueFeedback({
      team_rating: "3",
      venue_rating: "2",
      recommend: "maybe",
      share_review: "no",
    });

    assert.ok(mapped);
    assert.equal(mapped!.overallRating, 3);
    assert.equal(mapped!.wouldRecommend, false);
    assert.equal(mapped!.publicPermission, "none");
  });

  it("returns null when no ratings are present (cannot sync without a score)", () => {
    const mapped = mapPeFamilyToCoupleVenueFeedback({
      did_well: "Nice day",
      share_review: "yes",
    });
    assert.equal(mapped, null);
  });
});

describe("isFeedbackPubliclyEligible", () => {
  it("blocks public_permission none even with approval timestamp", () => {
    assert.equal(
      isFeedbackPubliclyEligible({
        publicPermission: "none",
        approvedForPublicAt: "2026-09-01T00:00:00Z",
      }),
      false,
    );
  });

  it("blocks permission granted but not approved", () => {
    assert.equal(
      isFeedbackPubliclyEligible({
        publicPermission: "review_and_names",
        approvedForPublicAt: null,
      }),
      false,
    );
  });

  it("allows permission granted + approved", () => {
    assert.equal(
      isFeedbackPubliclyEligible({
        publicPermission: "review_only",
        approvedForPublicAt: "2026-09-01T00:00:00Z",
      }),
      true,
    );
  });
});

describe("approval trust contract (documented)", () => {
  it("private permission can never be eligible even if a stamp were present", () => {
    // Mirrors approve_feedback_public WHERE public_permission != 'none'
    // and isPubliclyEligible = permission <> none AND approved_for_public_at IS NOT NULL
    assert.equal(
      isFeedbackPubliclyEligible({
        publicPermission: "none",
        approvedForPublicAt: "2099-01-01T00:00:00Z",
      }),
      false,
    );
  });
});
