/**
 * Server-authoritative SaaS list catalog for Pricing Launch V1.
 * Marketing and Checkout must derive display + Stripe line items from here
 * when `isPricingLaunchV1Ready()` is true.
 */

import type { PriceCatalogEntry, SaasPlanKey } from "./types";

export const PRICING_VERSION_V1 = "v1";

/** Lifetime Founding Member discount on the prevailing standard list price. */
export const FOUNDING_PERCENT_OFF = 10;

/** Standard White Glove one-time onboarding (Phase 1). */
export const WHITE_GLOVE_AMOUNT_CENTS = 49900;

/** Future Weven White Glove (Phase 2 — catalog constant only). */
export const WEVEN_WHITE_GLOVE_AMOUNT_CENTS = 39900;

/** Future Weven lifetime percent (Phase 2). */
export const WEVEN_PERCENT_OFF = 20;

/** Future organization group percent (Phase 4). */
export const GROUP_PERCENT_OFF = 10;

export const SAAS_PRICE_CATALOG_V1: readonly PriceCatalogEntry[] = [
  {
    planKey: "starter",
    name: "Gather",
    capacityMin: 0,
    capacityMax: 25,
    listAmountCents: 19900,
    capacityLabel: "0–25 annual celebrations",
  },
  {
    planKey: "growing",
    name: "Celebrate",
    capacityMin: 26,
    capacityMax: 75,
    listAmountCents: 24900,
    capacityLabel: "26–75 annual celebrations",
  },
  {
    planKey: "professional",
    name: "Flourish",
    capacityMin: 76,
    capacityMax: null,
    listAmountCents: 34900,
    capacityLabel: "76+ annual celebrations",
  },
] as const;

const BY_KEY: Record<SaasPlanKey, PriceCatalogEntry> = {
  starter: SAAS_PRICE_CATALOG_V1[0]!,
  growing: SAAS_PRICE_CATALOG_V1[1]!,
  professional: SAAS_PRICE_CATALOG_V1[2]!,
};

export function isSaasPlanKey(value: string): value is SaasPlanKey {
  return value === "starter" || value === "growing" || value === "professional";
}

export function getCatalogEntry(planKey: SaasPlanKey): PriceCatalogEntry {
  return BY_KEY[planKey];
}

export function listAmountCents(planKey: SaasPlanKey): number {
  return BY_KEY[planKey].listAmountCents;
}

/** Apply a whole-percent discount to a list amount (cents), rounded to nearest cent. */
export function amountAfterPercentOff(
  listAmountCents: number,
  percentOff: number,
): number {
  if (percentOff <= 0) return listAmountCents;
  if (percentOff >= 100) return 0;
  return Math.round(listAmountCents * (1 - percentOff / 100));
}

export function foundingAmountCents(planKey: SaasPlanKey): number {
  return amountAfterPercentOff(listAmountCents(planKey), FOUNDING_PERCENT_OFF);
}

export function wevenAmountCents(planKey: SaasPlanKey): number {
  return amountAfterPercentOff(listAmountCents(planKey), WEVEN_PERCENT_OFF);
}

export function groupAmountCents(planKey: SaasPlanKey): number {
  return amountAfterPercentOff(listAmountCents(planKey), GROUP_PERCENT_OFF);
}

export function planWevenDisplayAmounts(planKey: SaasPlanKey): {
  list: string;
  weven: string;
  whiteGlove: string;
  listCents: number;
  wevenCents: number;
} {
  const listCents = listAmountCents(planKey);
  const wevenCents = wevenAmountCents(planKey);
  return {
    list: formatUsdFromCents(listCents),
    weven: formatUsdFromCents(wevenCents),
    whiteGlove: formatUsdFromCents(WEVEN_WHITE_GLOVE_AMOUNT_CENTS),
    listCents,
    wevenCents,
  };
}

/** Format cents as `$199` or `$179.10` for marketing display. */
export function formatUsdFromCents(cents: number): string {
  const dollars = cents / 100;
  if (Number.isInteger(dollars)) return `$${dollars}`;
  return `$${dollars.toFixed(2)}`;
}

export function planDisplayAmounts(planKey: SaasPlanKey): {
  list: string;
  founding: string;
  listCents: number;
  foundingCents: number;
} {
  const listCents = listAmountCents(planKey);
  const foundingCents = foundingAmountCents(planKey);
  return {
    list: formatUsdFromCents(listCents),
    founding: formatUsdFromCents(foundingCents),
    listCents,
    foundingCents,
  };
}
