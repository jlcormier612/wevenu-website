/**
 * Customer-facing Luv draft context — provenance boundary.
 *
 * Venue-originated information must never enter generation context.
 * Customer-originated inquiry text may be included for personalization,
 * subject to communication judgment in the prompt (not a privacy substitute).
 *
 * Do not rely on the model to "keep private notes private."
 * Exclude venue-originated text before the prompt is built.
 */

import type { TrustTier } from "@/lib/lead-intake/types";

export type InquiryOrigin = "customer" | "venue";

/** Trust tiers whose inquiry text was authored by the customer. */
const CUSTOMER_ORIGINATED_TRUST_TIERS: ReadonlySet<TrustTier> = new Set([
  "direct",
  "webhook",
  "email_parsed",
]);

export function isCustomerOriginatedTrustTier(
  tier: string | null | undefined,
): boolean {
  if (!tier) return false;
  return CUSTOMER_ORIGINATED_TRUST_TIERS.has(tier as TrustTier);
}

/**
 * Fail closed: missing or non-customer intake provenance is venue-internal.
 * `leads.source` is not used — New Lead lets staff pick "Website" as
 * "how they found you," which is not proof the message is customer-authored.
 */
export function inquiryOriginFromTrustTier(
  trustTier: string | null | undefined,
): InquiryOrigin {
  return isCustomerOriginatedTrustTier(trustTier) ? "customer" : "venue";
}

/**
 * Only customer-originated inquiry text is eligible for the Luv prompt.
 * Venue-entered New Lead notes, imports, and unknown provenance return null.
 */
export function customerFacingInquiryMessage(
  inquiryMessage: string | null | undefined,
  origin: InquiryOrigin,
): string | null {
  if (origin !== "customer") return null;
  const trimmed = inquiryMessage?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveDraftDeleteDecision(
  existing: { id: string } | null,
  readError: { message?: string } | null,
): { proceed: true } | { proceed: false; message: string } {
  if (readError) {
    return { proceed: false, message: "Couldn't discard that draft. Please try again." };
  }
  if (!existing) {
    return { proceed: false, message: "That draft is no longer available." };
  }
  return { proceed: true };
}
