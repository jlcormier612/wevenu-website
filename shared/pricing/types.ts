/**
 * Shared SaaS pricing types — Phase 1A.
 * Plan keys match existing Checkout / CRM ids (starter|growing|professional).
 */

export type SaasPlanKey = "starter" | "growing" | "professional";

export type OfferType =
  | "founding_pct"
  | "weven_pct"
  | "group_pct"
  | "founder_override";

export type CheckoutOfferStatus =
  | "issued"
  | "paid"
  | "earned"
  | "expired"
  | "failed"
  | "superseded";

export type GrantStatus = "earned" | "revoked_prospective";

export type PriceCatalogEntry = {
  planKey: SaasPlanKey;
  name: string;
  /** Inclusive lower bound of qualifying booked events / calendar year */
  capacityMin: number;
  /** Inclusive upper bound; null = unlimited */
  capacityMax: number | null;
  listAmountCents: number;
  capacityLabel: string;
};

export type CheckoutOfferRecord = {
  id: string;
  checkoutSessionId: string | null;
  offerStatus: CheckoutOfferStatus;
  planKey: SaasPlanKey;
  listAmountCents: number;
  stripePriceId: string;
  foundingIssued: boolean;
  foundingPercentOff: number | null;
  stripeCouponId: string | null;
  pricingVersion: string;
  relationshipId: string | null;
  stripeCustomerId: string | null;
  ownerEmailNormalized: string | null;
  venueNameNormalized: string | null;
  earnedFoundingCountAtIssue: number | null;
  issuedAt: string;
  paidAt: string | null;
  earnedAt: string | null;
};

export type OfferGrantRecord = {
  id: string;
  offerType: OfferType;
  status: GrantStatus;
  percentOff: number | null;
  venueId: string | null;
  relationshipId: string | null;
  sourceCheckoutSessionId: string | null;
  sourceOfferId: string | null;
  earnedAt: string;
};

export type AppliedOfferRecord = {
  id: string;
  venueId: string | null;
  stripeSubscriptionId: string | null;
  appliedGrantId: string | null;
  offerType: OfferType | null;
  percentOff: number | null;
  stripeCouponId: string | null;
  listAmountCents: number | null;
  expectedInvoiceAmountCents: number | null;
  effectiveFrom: string;
};
