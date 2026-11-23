/**
 * Relationship-level standard discount eligibility (Stage 1E).
 *
 * Authoritative Sales UX field. Mirrors Stage 1C offer enums.
 * Syncs Welcome Back / foundingMember flags for checkout consistency.
 * Does not allocate Founding slots. Additional venue requires org qualification.
 */

import type {
  SalesOfferStandardDiscountEligibility,
  SalesOfferStandardDiscountEvidence,
} from "../pricing/sales-offer-types";
import {
  FOUNDING_PERCENT_OFF,
  GROUP_PERCENT_OFF,
  WEVEN_PERCENT_OFF,
  WEVEN_WHITE_GLOVE_AMOUNT_CENTS,
  WHITE_GLOVE_AMOUNT_CENTS,
  amountAfterPercentOff,
  formatUsdFromCents,
  getCatalogEntry,
  isSaasPlanKey,
  listAmountCents,
} from "../pricing/catalog";
import type { SaasPlanKey } from "../pricing/types";
import type { Relationship, WelcomeBackVerifiedStatus } from "./types";

export type StandardDiscountEligibility = SalesOfferStandardDiscountEligibility;
export type StandardDiscountEvidence = SalesOfferStandardDiscountEvidence;

export const STANDARD_DISCOUNT_ELIGIBILITY_VALUES: readonly StandardDiscountEligibility[] =
  [
    "not_established",
    "former_weven",
    "founding",
    "additional_venue",
    "none",
  ] as const;

export const STANDARD_DISCOUNT_LABELS: Record<
  StandardDiscountEligibility,
  string
> = {
  not_established: "Not established",
  former_weven: "Former Weven — 20% recurring",
  founding: "Founding Member — 10% recurring (subject to availability)",
  additional_venue: "Additional venue — 10% recurring when qualified",
  none: "No standard discount",
};

export function isStandardDiscountEligibility(
  value: unknown,
): value is StandardDiscountEligibility {
  return (
    typeof value === "string" &&
    (STANDARD_DISCOUNT_ELIGIBILITY_VALUES as readonly string[]).includes(value)
  );
}

/** Derive displayed eligibility from relationship fields (legacy + Stage 1E). */
export function resolveRelationshipStandardDiscount(
  relationship: Pick<
    Relationship,
    | "standardDiscountEligibility"
    | "standardDiscountEvidence"
    | "welcomeBackRequested"
    | "welcomeBackVerified"
    | "foundingMember"
  >,
): {
  eligibility: StandardDiscountEligibility;
  evidence: StandardDiscountEvidence;
  source: "explicit" | "legacy_flags";
} {
  if (
    relationship.standardDiscountEligibility &&
    isStandardDiscountEligibility(relationship.standardDiscountEligibility)
  ) {
    return {
      eligibility: relationship.standardDiscountEligibility,
      evidence:
        relationship.standardDiscountEvidence ??
        (relationship.standardDiscountEligibility === "not_established"
          ? "not_established"
          : relationship.standardDiscountEligibility === "none"
            ? "explicitly_none"
            : "founder_recorded"),
      source: "explicit",
    };
  }

  // Legacy: Welcome Back (not rejected) wins over founding flag.
  if (
    relationship.welcomeBackRequested &&
    relationship.welcomeBackVerified !== "rejected" &&
    relationship.welcomeBackVerified !== "expired"
  ) {
    return {
      eligibility: "former_weven",
      evidence:
        relationship.welcomeBackVerified === "verified"
          ? "application_confirmed"
          : "founder_recorded",
      source: "legacy_flags",
    };
  }
  if (relationship.foundingMember) {
    return {
      eligibility: "founding",
      evidence: "application_confirmed",
      source: "legacy_flags",
    };
  }
  return {
    eligibility: "not_established",
    evidence: "not_established",
    source: "legacy_flags",
  };
}

export type EligibilityFlagSync = {
  standardDiscountEligibility: StandardDiscountEligibility;
  standardDiscountEvidence: StandardDiscountEvidence;
  welcomeBackRequested: boolean;
  welcomeBackVerified: WelcomeBackVerifiedStatus;
  foundingMember: boolean;
};

/**
 * Map founder eligibility selection → durable fields + checkout-facing flags.
 * Prospective: later corrections overwrite. Does not consume Founding slots.
 */
export function buildEligibilityFlagSync(input: {
  eligibility: StandardDiscountEligibility;
  evidence?: StandardDiscountEvidence | null;
  previousVerified?: WelcomeBackVerifiedStatus;
}): EligibilityFlagSync {
  const eligibility = input.eligibility;
  let evidence: StandardDiscountEvidence = "not_established";
  if (eligibility === "none") evidence = "explicitly_none";
  else if (eligibility === "not_established") evidence = "not_established";
  else if (input.evidence === "application_confirmed") {
    evidence = "application_confirmed";
  } else {
    evidence = "founder_recorded";
  }

  if (eligibility === "former_weven") {
    const prev = input.previousVerified ?? "none";
    const welcomeBackVerified: WelcomeBackVerifiedStatus =
      prev === "verified" || prev === "pending" ? prev : "pending";
    return {
      standardDiscountEligibility: eligibility,
      standardDiscountEvidence: evidence,
      welcomeBackRequested: true,
      welcomeBackVerified,
      foundingMember: false,
    };
  }

  if (eligibility === "founding") {
    return {
      standardDiscountEligibility: eligibility,
      standardDiscountEvidence: evidence,
      welcomeBackRequested: false,
      welcomeBackVerified: "none",
      foundingMember: true,
    };
  }

  if (eligibility === "additional_venue") {
    return {
      standardDiscountEligibility: eligibility,
      standardDiscountEvidence: evidence,
      welcomeBackRequested: false,
      welcomeBackVerified: "none",
      foundingMember: false,
    };
  }

  // not_established | none
  return {
    standardDiscountEligibility: eligibility,
    standardDiscountEvidence: evidence,
    welcomeBackRequested: false,
    welcomeBackVerified: "none",
    foundingMember: false,
  };
}

export type StandardCheckoutCommercialTerms = {
  planKey: SaasPlanKey;
  planDisplayName: string;
  listAmountCents: number;
  listAmountLabel: string;
  eligibility: StandardDiscountEligibility;
  eligibilityLabel: string;
  discountBasis: string;
  discountPercentOff: number | null;
  recurringMonthlyCents: number;
  recurringMonthlyLabel: string;
  whiteGloveSelected: boolean;
  whiteGloveAmountCents: number;
  whiteGloveLabel: string;
  initialChargeCents: number;
  initialChargeLabel: string;
  taxesNote: string;
  billingTerms: string;
  /** Flags actually sent to marketing checkout */
  checkoutFlags: {
    welcome_back: boolean;
    group_eligible: boolean;
    /** Soft founding may still issue at checkout even when CRM says founding — never consumes on preview */
    founding_intent: boolean;
  };
};

export function crmPlanToSaasKey(planId: string | null | undefined): SaasPlanKey {
  const key = String(planId || "").toLowerCase();
  if (key === "celebrate" || key === "growing") return "growing";
  if (key === "flourish" || key === "professional") return "professional";
  if (isSaasPlanKey(key)) return key;
  return "starter";
}

/**
 * Commercial terms for standard Send/Copy Subscription Link review.
 * Mirrors checkout non-stacking: Weven > Founding > Group. No Stripe side effects.
 */
export function buildStandardCheckoutCommercialTerms(input: {
  planId: string;
  onboardingType: "self_guided" | "white_glove";
  eligibility: StandardDiscountEligibility;
  /** Only apply additional_venue discount when org qualification is proven. */
  additionalVenueQualified?: boolean;
}): StandardCheckoutCommercialTerms {
  const planKey = crmPlanToSaasKey(input.planId);
  const catalog = getCatalogEntry(planKey);
  const listAmountCentsValue = listAmountCents(planKey);
  const whiteGloveSelected = input.onboardingType === "white_glove";

  let discountPercentOff: number | null = null;
  let discountBasis = "No standard discount applied";
  let welcomeBack = false;
  let groupEligible = false;
  let foundingIntent = false;

  if (input.eligibility === "former_weven") {
    discountPercentOff = WEVEN_PERCENT_OFF;
    discountBasis = `Former Weven — ${WEVEN_PERCENT_OFF}% recurring (honor-system)`;
    welcomeBack = true;
  } else if (input.eligibility === "founding") {
    discountPercentOff = FOUNDING_PERCENT_OFF;
    discountBasis = `Founding Member — ${FOUNDING_PERCENT_OFF}% recurring (subject to soft availability at checkout; saving eligibility does not consume a slot)`;
    foundingIntent = true;
  } else if (input.eligibility === "additional_venue") {
    if (input.additionalVenueQualified) {
      discountPercentOff = GROUP_PERCENT_OFF;
      discountBasis = `Additional venue — ${GROUP_PERCENT_OFF}% recurring (organization qualified)`;
      groupEligible = true;
    } else {
      discountBasis =
        "Additional venue selected but not yet organization-qualified — checkout will use list price until qualified";
    }
  } else if (input.eligibility === "none") {
    discountBasis = "Explicitly no standard discount";
  } else {
    discountBasis = "Eligibility not established — list price";
  }

  const recurringMonthlyCents =
    discountPercentOff != null
      ? amountAfterPercentOff(listAmountCentsValue, discountPercentOff)
      : listAmountCentsValue;

  const whiteGloveAmountCents = whiteGloveSelected
    ? input.eligibility === "former_weven"
      ? WEVEN_WHITE_GLOVE_AMOUNT_CENTS
      : WHITE_GLOVE_AMOUNT_CENTS
    : 0;

  const whiteGloveLabel = !whiteGloveSelected
    ? "Not included"
    : input.eligibility === "former_weven"
      ? `Former Weven White Glove ${formatUsdFromCents(WEVEN_WHITE_GLOVE_AMOUNT_CENTS)} one-time`
      : `Standard White Glove ${formatUsdFromCents(WHITE_GLOVE_AMOUNT_CENTS)} one-time`;

  const initialChargeCents = recurringMonthlyCents + whiteGloveAmountCents;

  return {
    planKey,
    planDisplayName: catalog.name,
    listAmountCents: listAmountCentsValue,
    listAmountLabel: `${formatUsdFromCents(listAmountCentsValue)}/month`,
    eligibility: input.eligibility,
    eligibilityLabel: STANDARD_DISCOUNT_LABELS[input.eligibility],
    discountBasis,
    discountPercentOff,
    recurringMonthlyCents,
    recurringMonthlyLabel: `${formatUsdFromCents(recurringMonthlyCents)}/month`,
    whiteGloveSelected,
    whiteGloveAmountCents,
    whiteGloveLabel,
    initialChargeCents,
    initialChargeLabel: formatUsdFromCents(initialChargeCents),
    taxesNote:
      "Estimated initial charge before applicable taxes. Stripe Tax (if enabled) is calculated at checkout.",
    billingTerms:
      "Monthly subscription billed automatically. Cancel anytime. White Glove (if selected) is a one-time charge on the first invoice.",
    checkoutFlags: {
      welcome_back: welcomeBack,
      group_eligible: groupEligible,
      founding_intent: foundingIntent,
    },
  };
}
