/**
 * Batch 3.3 Stage 1 — Validate + compute sales offer commercial terms.
 * Single formula used by CRM preview and (later) Stage 2 checkout.
 */

import { createHash } from "node:crypto";

import {
  FOUNDING_PERCENT_OFF,
  GROUP_PERCENT_OFF,
  WEVEN_PERCENT_OFF,
  WHITE_GLOVE_AMOUNT_CENTS,
  WEVEN_WHITE_GLOVE_AMOUNT_CENTS,
  amountAfterPercentOff,
  foundingAmountCents,
  formatUsdFromCents,
  getCatalogEntry,
  listAmountCents,
  wevenAmountCents,
} from "./catalog";
import type { SaasPlanKey } from "./types";
import type {
  NormalizedSalesOfferTerms,
  SalesOfferComputedPreview,
  SalesOfferEligibilityHints,
  SalesOfferEligibleProjection,
  SalesOfferFixedReplacementPrices,
  SalesOfferStandardDiscountEligibility,
  SalesOfferStandardDiscountEvidence,
  SalesOfferTermsInput,
  SalesOfferValidationIssue,
  SalesOfferValidationResult,
} from "./sales-offer-types";

const ELIGIBILITY_VALUES: SalesOfferStandardDiscountEligibility[] = [
  "not_established",
  "former_weven",
  "founding",
  "additional_venue",
  "none",
];

const EVIDENCE_VALUES: SalesOfferStandardDiscountEvidence[] = [
  "not_established",
  "founder_recorded",
  "application_confirmed",
  "explicitly_none",
];

export function normalizeStandardDiscountEvidence(
  eligibility: SalesOfferStandardDiscountEligibility,
  evidence?: SalesOfferStandardDiscountEvidence | null,
): SalesOfferStandardDiscountEvidence {
  if (eligibility === "not_established") return "not_established";
  if (eligibility === "none") return "explicitly_none";
  if (evidence === "application_confirmed") return "application_confirmed";
  if (evidence === "founder_recorded") return "founder_recorded";
  return "founder_recorded";
}

/** Default selector from durable CRM application evidence only — never email/name heuristics. */
export function defaultEligibilityFromCrmHints(
  hints: SalesOfferEligibilityHints = {},
): {
  standardDiscountEligibility: SalesOfferStandardDiscountEligibility;
  standardDiscountEvidence: SalesOfferStandardDiscountEvidence;
} {
  if (hints.wevenEligible) {
    return {
      standardDiscountEligibility: "former_weven",
      standardDiscountEvidence: "application_confirmed",
    };
  }
  if (hints.foundingEligible) {
    return {
      standardDiscountEligibility: "founding",
      standardDiscountEvidence: "application_confirmed",
    };
  }
  if (hints.groupEligible) {
    return {
      standardDiscountEligibility: "additional_venue",
      standardDiscountEvidence: "application_confirmed",
    };
  }
  return {
    standardDiscountEligibility: "not_established",
    standardDiscountEvidence: "not_established",
  };
}

const HIGHER_TIERS: Record<SaasPlanKey, Array<"growing" | "professional">> = {
  starter: ["growing", "professional"],
  growing: ["professional"],
  professional: [],
};

function issue(
  field: string,
  message: string,
): SalesOfferValidationIssue {
  return { field, message };
}

function clampNonNegInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (!Number.isInteger(value)) return null;
  if (value < 0) return null;
  return value;
}

function normalizeReplacementPrices(
  raw: SalesOfferFixedReplacementPrices | undefined,
): SalesOfferFixedReplacementPrices {
  const out: SalesOfferFixedReplacementPrices = {};
  if (!raw || typeof raw !== "object") return out;
  for (const key of ["growing", "professional"] as const) {
    const v = raw[key];
    if (v == null) continue;
    const n = clampNonNegInt(v);
    if (n != null) out[key] = n;
  }
  return out;
}

function missingReplacementPaths(
  planKey: SaasPlanKey,
  replacements: SalesOfferFixedReplacementPrices,
): Array<"growing" | "professional"> {
  return HIGHER_TIERS[planKey].filter((tier) => replacements[tier] == null);
}

/**
 * Validate and normalize founder-authored terms.
 * Rejects negative amounts, stacked modes, and incomplete replace policies.
 */
export function validateSalesOfferTerms(
  input: SalesOfferTermsInput,
): SalesOfferValidationResult {
  const issues: SalesOfferValidationIssue[] = [];
  const planKey = input.planKey;

  if (
    planKey !== "starter" &&
    planKey !== "growing" &&
    planKey !== "professional"
  ) {
    issues.push(issue("planKey", "Select Gather, Celebrate, or Flourish."));
  }

  const list = planKey ? listAmountCents(planKey as SaasPlanKey) : 0;
  const pricingKind = input.pricingKind;

  let percentOff: number | null = null;
  let amountOffCents: number | null = null;
  let fixedRateCents: number | null = null;

  if (pricingKind === "standard") {
    if (
      input.percentOff != null ||
      input.amountOffCents != null ||
      input.fixedRateCents != null
    ) {
      // Ignore extras; standard has no adjustment fields.
    }
  } else if (pricingKind === "percent_off") {
    const pct = clampNonNegInt(input.percentOff ?? NaN);
    if (pct == null || pct < 1 || pct > 100) {
      issues.push(
        issue("percentOff", "Enter a whole-number percent between 1 and 100."),
      );
    } else {
      percentOff = pct;
    }
  } else if (pricingKind === "amount_off") {
    const off = clampNonNegInt(input.amountOffCents ?? NaN);
    if (off == null) {
      issues.push(
        issue(
          "amountOffCents",
          "Enter a non-negative whole-cent monthly discount.",
        ),
      );
    } else if (off <= 0) {
      issues.push(
        issue("amountOffCents", "Fixed-dollar discount must be greater than $0."),
      );
    } else if (off >= list) {
      issues.push(
        issue(
          "amountOffCents",
          "Fixed-dollar discount must be less than the standard monthly price.",
        ),
      );
    } else {
      amountOffCents = off;
    }
  } else if (pricingKind === "fixed_rate") {
    const rate = clampNonNegInt(input.fixedRateCents ?? NaN);
    if (rate == null) {
      issues.push(
        issue(
          "fixedRateCents",
          "Enter a non-negative whole-cent monthly subscription price.",
        ),
      );
    } else {
      fixedRateCents = rate;
    }
  } else {
    issues.push(issue("pricingKind", "Select a single pricing mode."));
  }

  const durationMode = input.durationMode;
  let durationBillingCycles: number | null = null;
  if (durationMode === "ongoing") {
    durationBillingCycles = null;
  } else if (durationMode === "billing_cycles") {
    const cycles = clampNonNegInt(input.durationBillingCycles ?? NaN);
    if (cycles == null || cycles < 1) {
      issues.push(
        issue(
          "durationBillingCycles",
          "Enter a positive number of billing cycles.",
        ),
      );
    } else {
      durationBillingCycles = cycles;
    }
  } else {
    issues.push(issue("durationMode", "Choose ongoing or a fixed cycle count."));
  }

  const afterIntroPricing = input.afterIntroPricing;
  if (
    afterIntroPricing !== "standard_list" &&
    afterIntroPricing !== "eligible_discount"
  ) {
    issues.push(
      issue("afterIntroPricing", "Choose how pricing resumes after the special period."),
    );
  }

  const percentUpgradePolicy = input.percentUpgradePolicy ?? "follow";
  const amountUpgradePolicy = input.amountUpgradePolicy ?? "follow";
  let fixedUpgradePolicy = input.fixedUpgradePolicy ?? "keep";
  const fixedReplacementPrices = normalizeReplacementPrices(
    input.fixedReplacementPrices,
  );
  let fixedUpgradeFallback = input.fixedUpgradeFallback ?? null;

  if (pricingKind === "percent_off") {
    if (percentUpgradePolicy !== "follow" && percentUpgradePolicy !== "end") {
      issues.push(
        issue("percentUpgradePolicy", "Choose whether the percent follows tier upgrades."),
      );
    }
    fixedUpgradePolicy = "keep";
    fixedUpgradeFallback = null;
  } else if (pricingKind === "amount_off") {
    if (amountUpgradePolicy !== "follow" && amountUpgradePolicy !== "end") {
      issues.push(
        issue("amountUpgradePolicy", "Choose whether the dollar discount follows upgrades."),
      );
    }
    fixedUpgradePolicy = "keep";
    fixedUpgradeFallback = null;
  } else if (pricingKind === "fixed_rate") {
    if (
      fixedUpgradePolicy !== "keep" &&
      fixedUpgradePolicy !== "end" &&
      fixedUpgradePolicy !== "replace"
    ) {
      issues.push(
        issue("fixedUpgradePolicy", "Choose keep, end, or replacement prices on upgrade."),
      );
    }
    if (fixedUpgradePolicy === "replace") {
      const missing = missingReplacementPaths(
        planKey as SaasPlanKey,
        fixedReplacementPrices,
      );
      if (
        missing.length > 0 &&
        fixedUpgradeFallback !== "standard_list" &&
        fixedUpgradeFallback !== "eligible_discount"
      ) {
        issues.push(
          issue(
            "fixedUpgradeFallback",
            `Set replacement prices for ${missing.join(" and ")} or choose a fallback when a path has no agreed price.`,
          ),
        );
      }
      if (
        fixedUpgradeFallback != null &&
        fixedUpgradeFallback !== "standard_list" &&
        fixedUpgradeFallback !== "eligible_discount"
      ) {
        issues.push(
          issue("fixedUpgradeFallback", "Fallback must be standard list or eligible discount."),
        );
      }
      // Require an explicit fallback whenever replace is used (unambiguous).
      if (fixedUpgradeFallback == null) {
        issues.push(
          issue(
            "fixedUpgradeFallback",
            "Choose a fallback for any upgrade path without an agreed replacement price.",
          ),
        );
      }
    } else {
      fixedUpgradeFallback = null;
    }
  } else {
    fixedUpgradePolicy = "keep";
    fixedUpgradeFallback = null;
  }

  const whiteGloveMode = input.whiteGloveMode;
  let whiteGloveAmountCents = 0;
  if (whiteGloveMode === "none" || whiteGloveMode === "waived") {
    whiteGloveAmountCents = 0;
  } else if (whiteGloveMode === "standard_499") {
    whiteGloveAmountCents = WHITE_GLOVE_AMOUNT_CENTS;
  } else if (whiteGloveMode === "weven_399") {
    whiteGloveAmountCents = WEVEN_WHITE_GLOVE_AMOUNT_CENTS;
  } else if (whiteGloveMode === "custom") {
    const custom = clampNonNegInt(input.whiteGloveAmountCents ?? NaN);
    if (custom == null) {
      issues.push(
        issue(
          "whiteGloveAmountCents",
          "Enter a non-negative White Glove amount in cents.",
        ),
      );
    } else {
      whiteGloveAmountCents = custom;
    }
  } else {
    issues.push(issue("whiteGloveMode", "Select a White Glove option."));
  }

  let expiresAt: string | null = null;
  if (input.expiresAt != null && String(input.expiresAt).trim() !== "") {
    const t = Date.parse(String(input.expiresAt));
    if (Number.isNaN(t)) {
      issues.push(issue("expiresAt", "Offer expiration must be a valid date."));
    } else {
      expiresAt = new Date(t).toISOString();
    }
  }

  const replacesStandardPromos = input.replacesStandardPromos !== false;

  const standardDiscountEligibility = (input.standardDiscountEligibility ??
    "not_established") as SalesOfferStandardDiscountEligibility;
  if (!ELIGIBILITY_VALUES.includes(standardDiscountEligibility)) {
    issues.push(
      issue(
        "standardDiscountEligibility",
        "Choose a valid standard discount eligibility option.",
      ),
    );
  }
  const standardDiscountEvidence = normalizeStandardDiscountEvidence(
    standardDiscountEligibility,
    input.standardDiscountEvidence ?? null,
  );
  if (!EVIDENCE_VALUES.includes(standardDiscountEvidence)) {
    issues.push(
      issue(
        "standardDiscountEvidence",
        "Choose a valid eligibility evidence value.",
      ),
    );
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const normalized: NormalizedSalesOfferTerms = {
    planKey: planKey as SaasPlanKey,
    listAmountCents: list,
    pricingKind,
    percentOff,
    amountOffCents,
    fixedRateCents,
    durationMode,
    durationBillingCycles,
    afterIntroPricing,
    percentUpgradePolicy:
      pricingKind === "percent_off" ? percentUpgradePolicy : "follow",
    amountUpgradePolicy:
      pricingKind === "amount_off" ? amountUpgradePolicy : "follow",
    fixedUpgradePolicy:
      pricingKind === "fixed_rate" ? fixedUpgradePolicy : "keep",
    fixedReplacementPrices:
      pricingKind === "fixed_rate" && fixedUpgradePolicy === "replace"
        ? fixedReplacementPrices
        : {},
    fixedUpgradeFallback:
      pricingKind === "fixed_rate" && fixedUpgradePolicy === "replace"
        ? fixedUpgradeFallback
        : null,
    whiteGloveMode,
    whiteGloveAmountCents,
    expiresAt,
    replacesStandardPromos,
    standardDiscountEligibility,
    standardDiscountEvidence,
  };

  return {
    ok: true,
    normalized,
    termsHash: hashNormalizedTerms(normalized),
  };
}

export function hashNormalizedTerms(terms: NormalizedSalesOfferTerms): string {
  const payload = JSON.stringify(terms);
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

export function monthlyRecurringFromNormalized(
  terms: NormalizedSalesOfferTerms,
): number {
  switch (terms.pricingKind) {
    case "standard":
      return terms.listAmountCents;
    case "percent_off":
      return amountAfterPercentOff(
        terms.listAmountCents,
        terms.percentOff ?? 0,
      );
    case "amount_off":
      return Math.max(0, terms.listAmountCents - (terms.amountOffCents ?? 0));
    case "fixed_rate":
      return terms.fixedRateCents ?? 0;
  }
}

function whiteGloveLabel(
  mode: NormalizedSalesOfferTerms["whiteGloveMode"],
  cents: number,
): string {
  switch (mode) {
    case "none":
      return "Not included";
    case "waived":
      return "Waived ($0)";
    case "standard_499":
      return `Standard ${formatUsdFromCents(WHITE_GLOVE_AMOUNT_CENTS)}`;
    case "weven_399":
      return `Former Weven ${formatUsdFromCents(WEVEN_WHITE_GLOVE_AMOUNT_CENTS)}`;
    case "custom":
      return `Custom ${formatUsdFromCents(cents)}`;
  }
}

function durationPhrase(terms: NormalizedSalesOfferTerms): string {
  if (terms.durationMode === "ongoing") return "the promotional period";
  const n = terms.durationBillingCycles ?? 0;
  if (n === 1) return "the one-month promotional period";
  return `the ${n}-month promotional period`;
}

function durationLabel(terms: NormalizedSalesOfferTerms): string {
  if (terms.durationMode === "ongoing") {
    return "Ongoing special pricing (until changed by founder or cancelled)";
  }
  const n = terms.durationBillingCycles ?? 0;
  return `Special pricing for your first ${n} month${n === 1 ? "" : "s"}`;
}

function afterIntroLabel(terms: NormalizedSalesOfferTerms): string {
  if (terms.durationMode === "ongoing") {
    return "Special pricing continues until changed or the subscription ends.";
  }
  if (terms.afterIntroPricing === "standard_list") {
    return "After your introductory period, your subscription will continue at the regular rate for your plan.";
  }
  return projectEligibleDiscount(
    terms.planKey,
    terms.standardDiscountEligibility,
  ).customerCopy;
}

function tierUpgradeLabel(terms: NormalizedSalesOfferTerms): string {
  if (terms.pricingKind === "standard") {
    return "Standard tier pricing applies; automatic upgrades follow ordinary volume rules.";
  }
  const window = durationPhrase(terms);
  const ongoing = terms.durationMode === "ongoing";

  if (terms.pricingKind === "percent_off") {
    if (terms.percentUpgradePolicy === "end") {
      return ongoing
        ? `If your venue moves to a higher plan, the ${terms.percentOff}% discount ends and the then-current rate for the new plan applies.`
        : `If your venue moves to a higher plan during ${window}, the ${terms.percentOff}% discount ends at that upgrade; otherwise it lasts until ${window} ends.`;
    }
    return ongoing
      ? `If your venue moves to a higher plan, your ${terms.percentOff}% discount applies to the new plan’s list price while special pricing continues.`
      : `If your venue moves to a higher plan during ${window}, your ${terms.percentOff}% discount applies to the new plan until ${window} ends.`;
  }

  if (terms.pricingKind === "amount_off") {
    const amt = formatUsdFromCents(terms.amountOffCents ?? 0);
    if (terms.amountUpgradePolicy === "end") {
      return ongoing
        ? `If your venue moves to a higher plan, the ${amt} monthly discount ends and the then-current rate for the new plan applies.`
        : `If your venue moves to a higher plan during ${window}, the ${amt} monthly discount ends at that upgrade.`;
    }
    return ongoing
      ? `If your venue moves to a higher plan, your ${amt} monthly discount applies to the new plan’s list price while special pricing continues.`
      : `If your venue moves to a higher plan during ${window}, your ${amt} monthly discount will apply to the new plan until ${window} ends.`;
  }

  // fixed_rate
  const fixed = formatUsdFromCents(terms.fixedRateCents ?? 0);
  if (terms.fixedUpgradePolicy === "keep") {
    return ongoing
      ? `If your venue moves to a higher plan, the negotiated ${fixed}/month continues while special pricing remains in effect.`
      : `If your venue moves to a higher plan during ${window}, the negotiated ${fixed}/month continues until ${window} ends.`;
  }
  if (terms.fixedUpgradePolicy === "end") {
    return ongoing
      ? `If your venue moves to a higher plan, the negotiated ${fixed}/month ends and the selected fallback pricing applies.`
      : `If your venue moves to a higher plan during ${window}, the negotiated ${fixed}/month ends at that upgrade.`;
  }
  const parts: string[] = [
    ongoing
      ? "If your venue moves to a higher plan, agreed replacement prices apply where set:"
      : `If your venue moves to a higher plan during ${window}, agreed replacement prices apply where set:`,
  ];
  for (const tier of HIGHER_TIERS[terms.planKey]) {
    const amt = terms.fixedReplacementPrices[tier];
    const name = getCatalogEntry(tier).name;
    if (amt != null) {
      parts.push(`${name} → ${formatUsdFromCents(amt)}/mo`);
    } else {
      parts.push(
        `${name} → fallback (${terms.fixedUpgradeFallback === "eligible_discount" ? "eligible standard discount or list" : "standard list"})`,
      );
    }
  }
  if (HIGHER_TIERS[terms.planKey].length === 0) {
    return "Flourish has no higher tier; fixed price stays until changed.";
  }
  return parts.join(" ");
}

/**
 * Project post-promo standard discount from the offer’s durable eligibility
 * selection. Does not invent eligibility; conditional outcomes stay labeled.
 */
export function projectEligibleDiscount(
  planKey: SaasPlanKey,
  eligibility: SalesOfferStandardDiscountEligibility | SalesOfferEligibilityHints = "not_established",
): SalesOfferEligibleProjection {
  // Legacy hints object → map to enum (Weven → Founding → group precedence).
  let category: SalesOfferStandardDiscountEligibility;
  if (typeof eligibility === "string") {
    category = eligibility;
  } else {
    if (eligibility.wevenEligible) category = "former_weven";
    else if (eligibility.foundingEligible) category = "founding";
    else if (eligibility.groupEligible) category = "additional_venue";
    else category = "not_established";
  }

  const list = listAmountCents(planKey);
  const planName = getCatalogEntry(planKey).name;
  const estimateNote =
    "Estimated using today’s prices. The actual amount will depend on the subscription tier, prevailing rates, and eligibility when the introductory period ends.";

  if (category === "former_weven") {
    const amountCents = wevenAmountCents(planKey);
    return {
      known: true,
      conditional: false,
      amountCents,
      label: `Former Weven (${WEVEN_PERCENT_OFF}% off)`,
      customerCopy: `After your introductory period, your eligible former Weven discount of ${WEVEN_PERCENT_OFF}% will apply to the subscription rate in effect at that time.`,
      explanation: `${formatUsdFromCents(amountCents)}/month at today’s ${planName} list. ${estimateNote}`,
    };
  }
  if (category === "founding") {
    const amountCents = foundingAmountCents(planKey);
    return {
      known: true,
      conditional: true,
      amountCents,
      label: `Founding Member (${FOUNDING_PERCENT_OFF}% off)`,
      customerCopy: `After your introductory period, a ${FOUNDING_PERCENT_OFF}% Founding Member discount may apply if you qualify. Otherwise, the regular subscription price will apply.`,
      explanation: `Conditional estimate ${formatUsdFromCents(amountCents)}/month at today’s ${planName} list (Founding first-100). Selecting this on a draft does not reserve a slot. ${estimateNote}`,
    };
  }
  if (category === "additional_venue") {
    const amountCents = amountAfterPercentOff(list, GROUP_PERCENT_OFF);
    return {
      known: true,
      conditional: true,
      amountCents,
      label: `Additional venue (${GROUP_PERCENT_OFF}% off)`,
      customerCopy: `After your introductory period, a ${GROUP_PERCENT_OFF}% additional-venue discount may apply if your organization qualifies. Otherwise, the regular subscription price will apply.`,
      explanation: `Conditional estimate ${formatUsdFromCents(amountCents)}/month at today’s ${planName} list — final application follows organization/venue rules. ${estimateNote}`,
    };
  }
  if (category === "none") {
    return {
      known: true,
      conditional: false,
      amountCents: list,
      label: "No standard discount",
      customerCopy:
        "After your introductory period, your subscription will continue at the regular rate for your plan.",
      explanation: `${formatUsdFromCents(list)}/month at today’s ${planName} list. ${estimateNote}`,
    };
  }
  // not_established — distinct from none / ineligible
  return {
    known: false,
    conditional: false,
    amountCents: null,
    label: "Not established yet",
    customerCopy:
      "After your introductory period, your subscription will continue at the applicable regular rate unless a qualifying discount is established.",
    explanation:
      "No confirmed discounted amount yet. Not established is not the same as ineligible. " +
      estimateNote,
  };
}

/**
 * Build founder + customer-style preview from validated terms.
 * Does not include internal notes.
 */
export function computeSalesOfferPreview(
  terms: NormalizedSalesOfferTerms,
  _legacyHints: SalesOfferEligibilityHints = {},
): SalesOfferComputedPreview {
  const catalog = getCatalogEntry(terms.planKey);
  const monthly = monthlyRecurringFromNormalized(terms);
  const savings = Math.max(0, terms.listAmountCents - monthly);
  const wg = terms.whiteGloveAmountCents;
  const initial = monthly + wg;
  const eligibleProjection = projectEligibleDiscount(
    terms.planKey,
    terms.standardDiscountEligibility,
  );

  const afterIntroMonthly =
    terms.durationMode === "billing_cycles"
      ? terms.afterIntroPricing === "standard_list"
        ? terms.listAmountCents
        : eligibleProjection.amountCents
      : null;

  const afterIntroCopy =
    terms.durationMode === "billing_cycles"
      ? terms.afterIntroPricing === "standard_list"
        ? "After your introductory period, your subscription will continue at the regular rate for your plan."
        : eligibleProjection.customerCopy
      : afterIntroLabel(terms);

  const lines: string[] = [
    `${catalog.name} · standard ${formatUsdFromCents(terms.listAmountCents)}/mo`,
    `Custom monthly ${formatUsdFromCents(monthly)}` +
      (savings > 0 ? ` (saves ${formatUsdFromCents(savings)}/mo)` : ""),
    durationLabel(terms),
    `White Glove: ${whiteGloveLabel(terms.whiteGloveMode, wg)}`,
    `Initial payment (before tax): ${formatUsdFromCents(initial)}`,
    `Then ${formatUsdFromCents(monthly)}/mo during special pricing`,
  ];

  if (terms.durationMode === "billing_cycles") {
    lines.push(afterIntroCopy);
    if (
      terms.afterIntroPricing === "eligible_discount" &&
      eligibleProjection.amountCents != null
    ) {
      lines.push(
        eligibleProjection.conditional
          ? `Post-promo estimate (conditional): ${formatUsdFromCents(eligibleProjection.amountCents)}/mo.`
          : `Post-promo estimate at today’s prices: ${formatUsdFromCents(eligibleProjection.amountCents)}/mo.`,
      );
    }
  }

  lines.push(tierUpgradeLabel(terms));

  const hasCustomPromo = terms.pricingKind !== "standard";
  const promoNote = !hasCustomPromo
    ? "This offer uses regular tier pricing for the selected plan. Applicable standard discounts are recorded separately and do not stack with each other."
    : terms.replacesStandardPromos
      ? "Custom promotional pricing replaces standard discounts while it is active. An eligible standard discount may resume afterward per these terms. Discounts do not stack."
      : "Founder chose not to replace standard promos (unusual).";

  lines.push(promoNote);

  return {
    planKey: terms.planKey,
    planDisplayName: catalog.name,
    capacityLabel: catalog.capacityLabel,
    listAmountCents: terms.listAmountCents,
    pricingKind: terms.pricingKind,
    monthlyRecurringCents: monthly,
    monthlySavingsCents: savings,
    whiteGloveAmountCents: wg,
    whiteGloveLabel: whiteGloveLabel(terms.whiteGloveMode, wg),
    initialPaymentCents: initial,
    futureMonthlyCents: monthly,
    afterIntroMonthlyCents: afterIntroMonthly,
    afterIntroLabel: afterIntroCopy,
    durationLabel: durationLabel(terms),
    tierUpgradeLabel: tierUpgradeLabel(terms),
    expiresAt: terms.expiresAt,
    replacesStandardPromos: terms.replacesStandardPromos,
    promoNote,
    lines,
    afterIntroStandardEstimateCents: terms.listAmountCents,
    afterIntroEligibleProjection: eligibleProjection,
  };
}

/** CRM planId (gather/celebrate/…) → SaaS plan key. */
export function crmPlanIdToSaasPlanKey(planId: string | null | undefined): SaasPlanKey {
  const key = String(planId || "").toLowerCase();
  if (key === "celebrate" || key === "growing") return "growing";
  if (key === "flourish" || key === "professional") return "professional";
  return "starter";
}

export function saasPlanKeyToCrmPlanId(planKey: SaasPlanKey): string {
  switch (planKey) {
    case "growing":
      return "celebrate";
    case "professional":
      return "flourish";
    default:
      return "gather";
  }
}

export function snapshotFromRecord(record: {
  status: string;
  internalName: string;
  internalNotes: string | null;
  reason: string | null;
  planKey: SaasPlanKey;
  listAmountCents: number;
  pricingKind: string;
  percentOff: number | null;
  amountOffCents: number | null;
  fixedRateCents: number | null;
  durationMode: string;
  durationBillingCycles: number | null;
  afterIntroPricing: string;
  percentUpgradePolicy: string;
  amountUpgradePolicy: string;
  fixedUpgradePolicy: string;
  fixedReplacementPrices: SalesOfferFixedReplacementPrices;
  fixedUpgradeFallback: string | null;
  whiteGloveMode: string;
  whiteGloveAmountCents: number;
  expiresAt: string | null;
  replacesStandardPromos: boolean;
  standardDiscountEligibility?: string;
  standardDiscountEvidence?: string;
  termsHash: string;
  revision: number;
}): Record<string, unknown> {
  return { ...record };
}
