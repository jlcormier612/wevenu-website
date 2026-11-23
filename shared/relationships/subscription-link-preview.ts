/**
 * Stage 1E — Subscription link review payload (no Stripe, no email).
 */

import { renderEmailTemplate } from "../email/templates/registry";
import {
  buildStandardCheckoutCommercialTerms,
  resolveRelationshipStandardDiscount,
  type StandardCheckoutCommercialTerms,
  type StandardDiscountEligibility,
} from "./standard-discount-eligibility";
import type { Relationship } from "./types";

export type SubscriptionLinkPreviewMode = "send" | "copy";

export type SubscriptionLinkPreview = {
  mode: SubscriptionLinkPreviewMode;
  relationshipId: string;
  venueName: string;
  recipientName: string;
  recipientEmail: string;
  planId: string;
  onboardingType: "self_guided" | "white_glove";
  terms: StandardCheckoutCommercialTerms;
  email: {
    subject: string;
    text: string;
    html: string;
  };
  checkoutLinkNote: string;
  expiresNote: string;
};

export function buildSubscriptionLinkPreview(input: {
  relationship: Relationship;
  mode: SubscriptionLinkPreviewMode;
  planId?: string;
  onboardingType?: "self_guided" | "white_glove";
  additionalVenueQualified?: boolean;
  /** Override eligibility for validation; defaults to relationship resolution */
  eligibilityOverride?: StandardDiscountEligibility;
}): SubscriptionLinkPreview {
  const relationship = input.relationship;
  const resolved = resolveRelationshipStandardDiscount(relationship);
  const eligibility = input.eligibilityOverride ?? resolved.eligibility;
  const planId = input.planId || relationship.planId || "gather";
  const onboardingType =
    input.onboardingType ||
    (relationship.onboardingType === "white_glove"
      ? "white_glove"
      : "self_guided");

  const terms = buildStandardCheckoutCommercialTerms({
    planId,
    onboardingType,
    eligibility,
    additionalVenueQualified: input.additionalVenueQualified,
  });

  const recipientName =
    [relationship.owner.firstName, relationship.owner.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() || relationship.owner.email;

  // Placeholder URL for rendered preview — never a constructed Stripe URL.
  const previewCheckoutPlaceholder =
    "[Checkout link will be generated only after you confirm]";

  const rendered = renderEmailTemplate("subscription_link", {
    firstName: relationship.owner.firstName,
    venueName: relationship.venue.name,
    planName: relationship.planName || terms.planDisplayName,
    checkoutUrl: previewCheckoutPlaceholder,
  });

  return {
    mode: input.mode,
    relationshipId: relationship.id,
    venueName: relationship.venue.name,
    recipientName,
    recipientEmail: relationship.owner.email,
    planId,
    onboardingType,
    terms,
    email: {
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    },
    checkoutLinkNote:
      input.mode === "send"
        ? "A Stripe Checkout Session is created only when you click Confirm & Send. The email will include the live checkout URL."
        : "A Stripe Checkout Session is created only when you click Confirm & Generate Link. Nothing is emailed.",
    expiresNote:
      "Checkout Sessions typically expire after about 24 hours. Generate a new link if the previous one expired. Never reconstruct a Checkout URL from a Session ID.",
  };
}

/** Server-side term fingerprint so Confirm validates what was previewed. */
export function subscriptionTermsFingerprint(
  terms: StandardCheckoutCommercialTerms,
): string {
  return [
    terms.planKey,
    terms.eligibility,
    terms.discountPercentOff ?? 0,
    terms.recurringMonthlyCents,
    terms.whiteGloveSelected ? 1 : 0,
    terms.whiteGloveAmountCents,
    terms.checkoutFlags.welcome_back ? 1 : 0,
    terms.checkoutFlags.group_eligible ? 1 : 0,
  ].join("|");
}
