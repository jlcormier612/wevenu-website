import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { enrollmentSummaryLines } from "./enrollment-summary";
import type { VenueEnrollmentRecord } from "./types";

function baseRecord(
  overrides: Partial<VenueEnrollmentRecord> = {},
): VenueEnrollmentRecord {
  return {
    id: "enr_test",
    createdAt: "2026-11-22T20:00:00.000Z",
    updatedAt: "2026-11-22T20:00:00.000Z",
    stripeSubscriptionId: "sub_test",
    stripeCustomerId: "cus_test",
    stripeCheckoutSessionId: "cs_test",
    venueName: "Test Venue",
    customerEmail: "owner@example.com",
    customerFirstName: "Ada",
    customerLastName: "Lovelace",
    plan: "starter",
    planName: "Gather",
    foundingMember: false,
    welcomeBackRequested: false,
    welcomeBackVerified: "none",
    onboardingType: "self_guided",
    paymentStatus: "successful",
    mrrCents: 19900,
    discountName: null,
    whiteGloveAmountCents: null,
    ...overrides,
  };
}

describe("enrollmentSummaryLines — Batch 3.2C founder notify", () => {
  it("includes discounted MRR and omits White Glove amount for self-setup", () => {
    const lines = enrollmentSummaryLines(baseRecord()).join("\n");
    assert.match(lines, /Monthly recurring \(after discount\):\n\$199/);
    assert.match(lines, /Discount:\nNone/);
    assert.match(lines, /White Glove purchase:\nNo/);
    assert.doesNotMatch(lines, /White Glove one-time amount:/);
  });

  it("makes White Glove purchase and amount prominent when purchased", () => {
    const lines = enrollmentSummaryLines(
      baseRecord({
        onboardingType: "white_glove",
        mrrCents: 17910,
        discountName: "Founding Member 10% forever (plans only)",
        whiteGloveAmountCents: 49900,
        foundingMember: true,
      }),
      { relationshipId: "rel_abc" },
    ).join("\n");
    assert.match(lines, /Monthly recurring \(after discount\):\n\$179\.10/);
    assert.match(lines, /Discount:\nFounding Member 10% forever/);
    assert.match(lines, /White Glove purchase:\nYes/);
    assert.match(lines, /White Glove one-time amount:\n\$499/);
    assert.match(lines, /CRM relationship:\n.*\/relationships\/rel_abc/);
    assert.match(lines, /do not push self-serve Setup Hub/);
  });
});
