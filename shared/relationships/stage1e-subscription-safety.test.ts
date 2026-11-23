import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildEligibilityFlagSync,
  buildStandardCheckoutCommercialTerms,
  resolveRelationshipStandardDiscount,
} from "./standard-discount-eligibility";
import {
  buildSubscriptionLinkPreview,
  subscriptionTermsFingerprint,
} from "./subscription-link-preview";
import type { Relationship } from "./types";
import {
  computeSalesOfferPreview,
  validateSalesOfferTerms,
} from "../pricing/sales-offer-compute";

function baseRelationship(
  patch: Partial<Relationship> = {},
): Relationship {
  return {
    id: "rel_test_stage1e",
    venue: {
      name: "Stage 1E Test Venue",
      city: "Austin",
      state: "TX",
    },
    owner: {
      id: "contact_test",
      firstName: "Test",
      lastName: "Owner",
      email: "stage1e-internal@hellotocheers.com",
    },
    status: "inquiry",
    health: "good",
    assignedTeamMemberId: "tm_1",
    planId: "gather",
    planName: "Gather",
    foundingMember: false,
    welcomeBackRequested: false,
    welcomeBackVerified: "none",
    onboardingType: "self_guided",
    currentStageLabel: "Inquiry",
    lastContactAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    supportOpenCount: 0,
    ...patch,
  };
}

describe("Stage 1E standard discount eligibility", () => {
  it("resolves former Weven from explicit field", () => {
    const r = baseRelationship({
      standardDiscountEligibility: "former_weven",
      standardDiscountEvidence: "founder_recorded",
    });
    const resolved = resolveRelationshipStandardDiscount(r);
    assert.equal(resolved.eligibility, "former_weven");
    assert.equal(resolved.source, "explicit");
  });

  it("maps former Weven to welcome_back without consuming founding", () => {
    const sync = buildEligibilityFlagSync({ eligibility: "former_weven" });
    assert.equal(sync.welcomeBackRequested, true);
    assert.equal(sync.foundingMember, false);
    assert.equal(sync.standardDiscountEligibility, "former_weven");
  });

  it("records founding intent without claiming a slot was consumed", () => {
    const sync = buildEligibilityFlagSync({ eligibility: "founding" });
    assert.equal(sync.foundingMember, true);
    assert.equal(sync.welcomeBackRequested, false);
  });

  it("allows prospective clear to none", () => {
    const sync = buildEligibilityFlagSync({ eligibility: "none" });
    assert.equal(sync.welcomeBackRequested, false);
    assert.equal(sync.foundingMember, false);
    assert.equal(sync.standardDiscountEvidence, "explicitly_none");
  });
});

describe("Stage 1E subscription commercial terms", () => {
  it("applies former Weven 20% and $399 White Glove", () => {
    const terms = buildStandardCheckoutCommercialTerms({
      planId: "gather",
      onboardingType: "white_glove",
      eligibility: "former_weven",
    });
    assert.equal(terms.listAmountCents, 19900);
    assert.equal(terms.recurringMonthlyCents, 15920);
    assert.equal(terms.whiteGloveAmountCents, 39900);
    assert.equal(terms.checkoutFlags.welcome_back, true);
    assert.equal(terms.discountPercentOff, 20);
  });

  it("does not grant additional venue without qualification", () => {
    const terms = buildStandardCheckoutCommercialTerms({
      planId: "gather",
      onboardingType: "self_guided",
      eligibility: "additional_venue",
      additionalVenueQualified: false,
    });
    assert.equal(terms.recurringMonthlyCents, 19900);
    assert.equal(terms.checkoutFlags.group_eligible, false);
    assert.match(terms.discountBasis, /not yet organization-qualified/i);
  });

  it("applies additional venue when qualified", () => {
    const terms = buildStandardCheckoutCommercialTerms({
      planId: "gather",
      onboardingType: "self_guided",
      eligibility: "additional_venue",
      additionalVenueQualified: true,
    });
    assert.equal(terms.recurringMonthlyCents, 17910);
    assert.equal(terms.checkoutFlags.group_eligible, true);
  });

  it("does not stack Weven with founding in checkout flags", () => {
    const terms = buildStandardCheckoutCommercialTerms({
      planId: "celebrate",
      onboardingType: "self_guided",
      eligibility: "former_weven",
    });
    assert.equal(terms.checkoutFlags.welcome_back, true);
    assert.equal(terms.checkoutFlags.founding_intent, false);
    assert.equal(terms.discountPercentOff, 20);
  });
});

describe("Stage 1E subscription link preview", () => {
  it("renders real template body without creating a checkout URL", () => {
    const preview = buildSubscriptionLinkPreview({
      relationship: baseRelationship({
        standardDiscountEligibility: "founding",
      }),
      mode: "send",
      planId: "gather",
      onboardingType: "self_guided",
    });
    assert.equal(preview.recipientEmail, "stage1e-internal@hellotocheers.com");
    assert.match(preview.email.subject, /subscription link/i);
    assert.match(preview.email.text, /will be generated only after you confirm/i);
    assert.doesNotMatch(preview.email.text, /checkout\.stripe\.com/i);
    assert.equal(preview.terms.eligibility, "founding");
    const fp = subscriptionTermsFingerprint(preview.terms);
    assert.ok(fp.includes("founding"));
  });
});

describe("Stage 1E offer summary copy", () => {
  it("does not describe regular tier pricing as a custom promo override", () => {
    const validated = validateSalesOfferTerms({
      planKey: "starter",
      pricingKind: "standard",
      durationMode: "ongoing",
      afterIntroPricing: "standard_list",
      whiteGloveMode: "none",
      standardDiscountEligibility: "not_established",
    });
    assert.equal(validated.ok, true);
    if (!validated.ok) return;
    const preview = computeSalesOfferPreview(validated.normalized);
    assert.match(preview.promoNote, /regular tier pricing/i);
    assert.doesNotMatch(preview.promoNote, /Custom promotional pricing replaces/i);
  });
});
