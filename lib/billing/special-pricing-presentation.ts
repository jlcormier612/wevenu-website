/**
 * Customer-facing special pricing honesty helpers.
 * Never invent a catalog plan (e.g. starter / $199) when saas_plan_key is absent.
 */

import { isSaasPlanKey, type SaasPlanKey } from "@shared/pricing";

export function resolveCustomerBilledPlanKey(
  saasPlanKey: string | null | undefined,
): SaasPlanKey | null {
  const raw = String(saasPlanKey ?? "");
  return isSaasPlanKey(raw) ? (raw as SaasPlanKey) : null;
}

export const UNLINKED_SPECIAL_PRICING_MESSAGE =
  "No Hello to Cheers subscription plan is linked to this venue yet. Catalog pricing appears after a plan is assigned.";

export function buildUnlinkedSpecialPricingPayload(
  currentPeriodEnd: string | null | undefined,
) {
  return {
    ok: true as const,
    hasBilledPlan: false as const,
    currentTier: null,
    standardRecurringPrice: null,
    appliedDiscount: null,
    actualRecurringPrice: null,
    nextRenewal: currentPeriodEnd ?? null,
    scheduledChanges: [] as const,
    activeSpecialPricing: [] as const,
    message: UNLINKED_SPECIAL_PRICING_MESSAGE,
  };
}
