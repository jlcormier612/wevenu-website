/**
 * Batch 3.3 Stage 1 — Pre-purchase founder sales offer types.
 * Authoritative commercial terms for CRM drafts (no Stripe side effects).
 */

import type { SaasPlanKey } from "./types";

export type SalesOfferStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "accepted"
  | "expired"
  | "revoked"
  | "superseded"
  | "discarded";

export type SalesOfferPricingKind =
  | "standard"
  | "percent_off"
  | "amount_off"
  | "fixed_rate";

export type SalesOfferDurationMode = "ongoing" | "billing_cycles";

export type SalesOfferAfterIntroPricing =
  | "standard_list"
  | "eligible_discount";

export type SalesOfferPercentUpgradePolicy = "follow" | "end";

export type SalesOfferAmountUpgradePolicy = "follow" | "end";

export type SalesOfferFixedUpgradePolicy = "keep" | "end" | "replace";

export type SalesOfferFixedUpgradeFallback =
  | "standard_list"
  | "eligible_discount";

export type SalesOfferWhiteGloveMode =
  | "none"
  | "standard_499"
  | "weven_399"
  | "custom"
  | "waived";

/**
 * Standard discount category for post-promo / fallback pricing.
 * `not_established` is not the same as `none` (explicitly no discount).
 */
export type SalesOfferStandardDiscountEligibility =
  | "not_established"
  | "former_weven"
  | "founding"
  | "additional_venue"
  | "none";

/**
 * How the eligibility value was established — durable for Stage 2.
 * Founder-recorded ≠ application-confirmed ≠ unknown ≠ explicitly none.
 */
export type SalesOfferStandardDiscountEvidence =
  | "not_established"
  | "founder_recorded"
  | "application_confirmed"
  | "explicitly_none";

/** Destination-tier replacement fixed monthly amounts (cents). */
export type SalesOfferFixedReplacementPrices = Partial<
  Record<"growing" | "professional", number>
>;

export type SalesOfferTermsInput = {
  planKey: SaasPlanKey;
  pricingKind: SalesOfferPricingKind;
  percentOff?: number | null;
  amountOffCents?: number | null;
  fixedRateCents?: number | null;
  durationMode: SalesOfferDurationMode;
  durationBillingCycles?: number | null;
  afterIntroPricing: SalesOfferAfterIntroPricing;
  percentUpgradePolicy?: SalesOfferPercentUpgradePolicy;
  amountUpgradePolicy?: SalesOfferAmountUpgradePolicy;
  fixedUpgradePolicy?: SalesOfferFixedUpgradePolicy;
  fixedReplacementPrices?: SalesOfferFixedReplacementPrices;
  fixedUpgradeFallback?: SalesOfferFixedUpgradeFallback | null;
  whiteGloveMode: SalesOfferWhiteGloveMode;
  whiteGloveAmountCents?: number | null;
  expiresAt?: string | null;
  replacesStandardPromos?: boolean;
  standardDiscountEligibility?: SalesOfferStandardDiscountEligibility;
  standardDiscountEvidence?: SalesOfferStandardDiscountEvidence;
};

export type SalesOfferRecord = {
  id: string;
  relationshipId: string;
  venueId: string | null;
  status: SalesOfferStatus;
  internalName: string;
  internalNotes: string | null;
  reason: string | null;
  planKey: SaasPlanKey;
  listAmountCents: number;
  pricingKind: SalesOfferPricingKind;
  percentOff: number | null;
  amountOffCents: number | null;
  fixedRateCents: number | null;
  durationMode: SalesOfferDurationMode;
  durationBillingCycles: number | null;
  afterIntroPricing: SalesOfferAfterIntroPricing;
  percentUpgradePolicy: SalesOfferPercentUpgradePolicy;
  amountUpgradePolicy: SalesOfferAmountUpgradePolicy;
  fixedUpgradePolicy: SalesOfferFixedUpgradePolicy;
  fixedReplacementPrices: SalesOfferFixedReplacementPrices;
  fixedUpgradeFallback: SalesOfferFixedUpgradeFallback | null;
  whiteGloveMode: SalesOfferWhiteGloveMode;
  whiteGloveAmountCents: number;
  expiresAt: string | null;
  replacesStandardPromos: boolean;
  standardDiscountEligibility: SalesOfferStandardDiscountEligibility;
  standardDiscountEvidence: SalesOfferStandardDiscountEvidence;
  revision: number;
  createdByUserId: string | null;
  createdByEmail: string | null;
  updatedByUserId: string | null;
  updatedByEmail: string | null;
  supersedesOfferId: string | null;
  supersededByOfferId: string | null;
  checkoutSessionId: string | null;
  checkoutOfferId: string | null;
  acceptedAt: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  revokedAt: string | null;
  discardedAt: string | null;
  termsHash: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type SalesOfferRevisionRecord = {
  id: string;
  offerId: string;
  revision: number;
  status: SalesOfferStatus;
  snapshot: Record<string, unknown>;
  changedByUserId: string | null;
  changedByEmail: string | null;
  changeSummary: string | null;
  createdAt: string;
};

export type SalesOfferCreateInput = {
  relationshipId: string;
  venueId?: string | null;
  internalName: string;
  internalNotes?: string | null;
  reason?: string | null;
  terms: SalesOfferTermsInput;
  createdByUserId?: string | null;
  createdByEmail?: string | null;
};

export type SalesOfferUpdateInput = {
  offerId: string;
  relationshipId: string;
  expectedRevision: number;
  internalName?: string;
  internalNotes?: string | null;
  reason?: string | null;
  terms?: SalesOfferTermsInput;
  updatedByUserId?: string | null;
  updatedByEmail?: string | null;
  changeSummary?: string | null;
};

/** CRM application hints used only to default the Stage 1C selector. */
export type SalesOfferEligibilityHints = {
  foundingEligible?: boolean;
  /** Former Weven — welcome-back requested / verified, or known Weven grant. */
  wevenEligible?: boolean;
  groupEligible?: boolean;
};

export type SalesOfferEligibleProjection = {
  known: boolean;
  /** True when amount is conditional (Founding slot / org qualification). */
  conditional: boolean;
  amountCents: number | null;
  label: string;
  /** Concise customer-facing after-intro sentence. */
  customerCopy: string;
  /** Founder-facing estimate note (not for customer preview). */
  explanation: string;
};

export type SalesOfferComputedPreview = {
  planKey: SaasPlanKey;
  planDisplayName: string;
  capacityLabel: string;
  listAmountCents: number;
  pricingKind: SalesOfferPricingKind;
  monthlyRecurringCents: number;
  monthlySavingsCents: number;
  whiteGloveAmountCents: number;
  whiteGloveLabel: string;
  initialPaymentCents: number;
  futureMonthlyCents: number;
  afterIntroMonthlyCents: number | null;
  afterIntroLabel: string;
  durationLabel: string;
  tierUpgradeLabel: string;
  expiresAt: string | null;
  replacesStandardPromos: boolean;
  promoNote: string;
  lines: string[];
  /** Estimate at today's list for the selected tier (not a guaranteed future charge). */
  afterIntroStandardEstimateCents: number;
  afterIntroEligibleProjection: SalesOfferEligibleProjection;
};

export type SalesOfferValidationIssue = {
  field: string;
  message: string;
};

export type SalesOfferValidationResult =
  | { ok: true; normalized: NormalizedSalesOfferTerms; termsHash: string }
  | { ok: false; issues: SalesOfferValidationIssue[] };

export type NormalizedSalesOfferTerms = {
  planKey: SaasPlanKey;
  listAmountCents: number;
  pricingKind: SalesOfferPricingKind;
  percentOff: number | null;
  amountOffCents: number | null;
  fixedRateCents: number | null;
  durationMode: SalesOfferDurationMode;
  durationBillingCycles: number | null;
  afterIntroPricing: SalesOfferAfterIntroPricing;
  percentUpgradePolicy: SalesOfferPercentUpgradePolicy;
  amountUpgradePolicy: SalesOfferAmountUpgradePolicy;
  fixedUpgradePolicy: SalesOfferFixedUpgradePolicy;
  fixedReplacementPrices: SalesOfferFixedReplacementPrices;
  fixedUpgradeFallback: SalesOfferFixedUpgradeFallback | null;
  whiteGloveMode: SalesOfferWhiteGloveMode;
  whiteGloveAmountCents: number;
  expiresAt: string | null;
  replacesStandardPromos: boolean;
  standardDiscountEligibility: SalesOfferStandardDiscountEligibility;
  standardDiscountEvidence: SalesOfferStandardDiscountEvidence;
};
