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
  SalesOfferTermsInput,
  SalesOfferValidationIssue,
  SalesOfferValidationResult,
} from "./sales-offer-types";

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

function durationLabel(terms: NormalizedSalesOfferTerms): string {
  if (terms.durationMode === "ongoing") {
    return "Ongoing special pricing (until changed by founder or cancelled)";
  }
  const n = terms.durationBillingCycles ?? 0;
  return `${n} billing cycle${n === 1 ? "" : "s"} of special pricing`;
}

function afterIntroLabel(terms: NormalizedSalesOfferTerms): string {
  if (terms.durationMode === "ongoing") {
    return "Special pricing continues until the founder changes it or the subscription ends.";
  }
  if (terms.afterIntroPricing === "eligible_discount") {
    return (
      `After the introductory period, resume an eligible standard discount ` +
      `(Founding ${FOUNDING_PERCENT_OFF}%, former Weven ${WEVEN_PERCENT_OFF}%, or additional-venue) ` +
      `if still earned — otherwise the then-current tier list price. Custom offer does not stack with those discounts.`
    );
  }
  return "After the introductory period, resume the then-current tier’s standard list price.";
}

function tierUpgradeLabel(terms: NormalizedSalesOfferTerms): string {
  if (terms.pricingKind === "standard") {
    return "Standard tier pricing applies; automatic upgrades follow ordinary volume rules.";
  }
  if (terms.pricingKind === "percent_off") {
    if (terms.percentUpgradePolicy === "end") {
      return `The ${terms.percentOff}% discount ends if the venue upgrades tiers; then the then-current list (or selected after-intro rule) applies.`;
    }
    return `The ${terms.percentOff}% discount follows the venue into the new tier’s standard list price.`;
  }
  if (terms.pricingKind === "amount_off") {
    if (terms.amountUpgradePolicy === "end") {
      return `The ${formatUsdFromCents(terms.amountOffCents ?? 0)} monthly discount ends on tier upgrade.`;
    }
    return `The ${formatUsdFromCents(terms.amountOffCents ?? 0)} monthly discount continues against the new tier’s list price.`;
  }
  // fixed_rate
  if (terms.fixedUpgradePolicy === "keep") {
    return `Keep the negotiated ${formatUsdFromCents(terms.fixedRateCents ?? 0)}/mo across tier upgrades.`;
  }
  if (terms.fixedUpgradePolicy === "end") {
    return "End the fixed custom price on tier upgrade and resume the selected fallback / after-intro rule.";
  }
  const parts: string[] = ["On upgrade, use agreed replacement prices where set:"];
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
 * Project the best non-stacking standard discount estimate for a plan,
 * based only on verified/indicated eligibility — never invent Weven/Founding.
 */
export function projectEligibleDiscount(
  planKey: SaasPlanKey,
  hints: SalesOfferEligibilityHints = {},
): SalesOfferEligibleProjection {
  const list = listAmountCents(planKey);
  // Non-stacking precedence matches checkout: Weven → Founding → group.
  if (hints.wevenEligible) {
    return {
      known: true,
      amountCents: wevenAmountCents(planKey),
      label: `Eligible former Weven (${WEVEN_PERCENT_OFF}% off)`,
      explanation: `Estimate at today’s ${getCatalogEntry(planKey).name} list — ${formatUsdFromCents(wevenAmountCents(planKey))}/mo. Actual future amount follows then-current list and eligibility.`,
    };
  }
  if (hints.foundingEligible) {
    return {
      known: true,
      amountCents: foundingAmountCents(planKey),
      label: `Eligible Founding (${FOUNDING_PERCENT_OFF}% off)`,
      explanation: `Estimate at today’s ${getCatalogEntry(planKey).name} list — ${formatUsdFromCents(foundingAmountCents(planKey))}/mo. Actual future amount follows then-current list and eligibility.`,
    };
  }
  if (hints.groupEligible) {
    const groupCents = amountAfterPercentOff(list, GROUP_PERCENT_OFF);
    return {
      known: true,
      amountCents: groupCents,
      label: `Eligible additional-venue (${GROUP_PERCENT_OFF}% off)`,
      explanation: `Estimate at today’s list — ${formatUsdFromCents(groupCents)}/mo.`,
    };
  }
  return {
    known: false,
    amountCents: null,
    label: "Eligible discounted price",
    explanation:
      "No verified Founding, former Weven, or additional-venue eligibility is on file for this prospect. If they later qualify, that discount can apply after the special period — otherwise the then-current regular tier price applies.",
  };
}

/**
 * Build founder + customer-style preview from validated terms.
 * Does not include internal notes.
 */
export function computeSalesOfferPreview(
  terms: NormalizedSalesOfferTerms,
  eligibility: SalesOfferEligibilityHints = {},
): SalesOfferComputedPreview {
  const catalog = getCatalogEntry(terms.planKey);
  const monthly = monthlyRecurringFromNormalized(terms);
  const savings = Math.max(0, terms.listAmountCents - monthly);
  const wg = terms.whiteGloveAmountCents;
  const initial = monthly + wg;
  const eligibleProjection = projectEligibleDiscount(terms.planKey, eligibility);

  const afterIntroMonthly =
    terms.durationMode === "billing_cycles"
      ? terms.afterIntroPricing === "standard_list"
        ? terms.listAmountCents
        : eligibleProjection.known
          ? eligibleProjection.amountCents
          : null
      : null;

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
    if (terms.afterIntroPricing === "standard_list") {
      lines.push(
        `After intro (estimate at today’s prices): ${formatUsdFromCents(terms.listAmountCents)}/mo regular ${catalog.name}. Actual amount follows then-current tier list.`,
      );
    } else if (eligibleProjection.known && eligibleProjection.amountCents != null) {
      lines.push(
        `After intro (estimate): ${formatUsdFromCents(eligibleProjection.amountCents)}/mo — ${eligibleProjection.label}.`,
      );
    } else {
      lines.push(afterIntroLabel(terms));
    }
  }

  lines.push(tierUpgradeLabel(terms));

  const promoNote = terms.replacesStandardPromos
    ? "This custom offer replaces Founding, former Weven, and additional-venue discounts at checkout. Underlying former Weven eligibility is not erased."
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
    afterIntroLabel: afterIntroLabel(terms),
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
  termsHash: string;
  revision: number;
}): Record<string, unknown> {
  return { ...record };
}
