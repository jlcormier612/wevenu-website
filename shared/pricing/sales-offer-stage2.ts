/**
 * Batch 3.3 Stage 2 — send / view / accept / checkout / paid helpers.
 * Pure commercial + lifecycle logic; I/O stays in CRM/marketing routes.
 */

import { createHash, randomBytes } from "node:crypto";

import {
  computeSalesOfferPreview,
  monthlyRecurringFromNormalized,
  validateSalesOfferTerms,
} from "./sales-offer-compute";
import type {
  SalesOfferAcceptedSnapshot,
  SalesOfferRecord,
  SalesOfferStatus,
} from "./sales-offer-types";

export function newSalesOfferPublicToken(): string {
  return randomBytes(32).toString("hex");
}

export function normalizeOfferEmail(email: string | null | undefined): string | null {
  const t = email?.trim().toLowerCase() || "";
  if (!t) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return null;
  return t;
}

export function isOfferExpired(offer: Pick<SalesOfferRecord, "expiresAt" | "status">, now = new Date()): boolean {
  if (offer.status === "expired") return true;
  if (!offer.expiresAt) return false;
  return new Date(offer.expiresAt).getTime() <= now.getTime();
}

const TERMINAL: SalesOfferStatus[] = [
  "paid",
  "expired",
  "revoked",
  "superseded",
  "discarded",
];

export function canCustomerOpenOffer(status: SalesOfferStatus): boolean {
  return (
    status === "sent" ||
    status === "viewed" ||
    status === "accepted" ||
    status === "checkout_pending"
  );
}

export function canAcceptOffer(offer: SalesOfferRecord, now = new Date()): {
  ok: true;
} | { ok: false; code: string; message: string } {
  if (TERMINAL.includes(offer.status) && offer.status !== "accepted" && offer.status !== "checkout_pending") {
    return {
      ok: false,
      code: "offer_unavailable",
      message:
        offer.status === "revoked"
          ? "This offer has been withdrawn."
          : offer.status === "superseded"
            ? "This offer has been replaced by a newer version."
            : offer.status === "paid"
              ? "This offer has already been completed."
              : "This offer is no longer available.",
    };
  }
  if (offer.status === "draft" || offer.status === "discarded") {
    return { ok: false, code: "offer_not_sent", message: "This offer is not available." };
  }
  if (isOfferExpired(offer, now)) {
    return {
      ok: false,
      code: "offer_expired",
      message: "This offer has expired. Please contact Hello to Cheers for a new offer.",
    };
  }
  if (offer.status === "accepted" || offer.status === "checkout_pending") {
    return { ok: true }; // resume checkout allowed
  }
  if (offer.status === "sent" || offer.status === "viewed") {
    return { ok: true };
  }
  return { ok: false, code: "offer_unavailable", message: "This offer cannot be accepted." };
}

export function buildAcceptedSnapshot(input: {
  offer: SalesOfferRecord;
  venueName: string;
  recipientName: string;
  recipientEmail: string;
  acceptedAt: string;
}): SalesOfferAcceptedSnapshot | { error: string } {
  const validated = validateSalesOfferTerms({
    planKey: input.offer.planKey,
    pricingKind: input.offer.pricingKind,
    percentOff: input.offer.percentOff,
    amountOffCents: input.offer.amountOffCents,
    fixedRateCents: input.offer.fixedRateCents,
    durationMode: input.offer.durationMode,
    durationBillingCycles: input.offer.durationBillingCycles,
    afterIntroPricing: input.offer.afterIntroPricing,
    percentUpgradePolicy: input.offer.percentUpgradePolicy,
    amountUpgradePolicy: input.offer.amountUpgradePolicy,
    fixedUpgradePolicy: input.offer.fixedUpgradePolicy,
    fixedReplacementPrices: input.offer.fixedReplacementPrices,
    fixedUpgradeFallback: input.offer.fixedUpgradeFallback,
    whiteGloveMode: input.offer.whiteGloveMode,
    whiteGloveAmountCents: input.offer.whiteGloveAmountCents,
    expiresAt: input.offer.expiresAt,
    replacesStandardPromos: input.offer.replacesStandardPromos,
    standardDiscountEligibility: input.offer.standardDiscountEligibility,
    standardDiscountEvidence: input.offer.standardDiscountEvidence,
  });
  if (!validated.ok) {
    return { error: "Offer terms are invalid and cannot be accepted." };
  }
  if (validated.termsHash !== input.offer.termsHash) {
    return { error: "Offer terms changed since last save. Ask Hello to Cheers to resend." };
  }
  const n = validated.normalized;
  return {
    offerId: input.offer.id,
    relationshipId: input.offer.relationshipId,
    revision: input.offer.revision,
    termsHash: validated.termsHash,
    planKey: n.planKey,
    listAmountCents: n.listAmountCents,
    pricingKind: n.pricingKind,
    percentOff: n.percentOff,
    amountOffCents: n.amountOffCents,
    fixedRateCents: n.fixedRateCents,
    durationMode: n.durationMode,
    durationBillingCycles: n.durationBillingCycles,
    afterIntroPricing: n.afterIntroPricing,
    percentUpgradePolicy: n.percentUpgradePolicy,
    amountUpgradePolicy: n.amountUpgradePolicy,
    fixedUpgradePolicy: n.fixedUpgradePolicy,
    fixedReplacementPrices: n.fixedReplacementPrices,
    fixedUpgradeFallback: n.fixedUpgradeFallback,
    whiteGloveMode: n.whiteGloveMode,
    whiteGloveAmountCents: n.whiteGloveAmountCents,
    replacesStandardPromos: n.replacesStandardPromos,
    standardDiscountEligibility: n.standardDiscountEligibility,
    standardDiscountEvidence: n.standardDiscountEvidence,
    monthlyRecurringCents: monthlyRecurringFromNormalized(n),
    recipientName: input.recipientName,
    recipientEmail: input.recipientEmail,
    venueName: input.venueName,
    acceptedAt: input.acceptedAt,
  };
}

export function publicOfferViewModel(offer: SalesOfferRecord, venueName: string) {
  const validated = validateSalesOfferTerms({
    planKey: offer.planKey,
    pricingKind: offer.pricingKind,
    percentOff: offer.percentOff,
    amountOffCents: offer.amountOffCents,
    fixedRateCents: offer.fixedRateCents,
    durationMode: offer.durationMode,
    durationBillingCycles: offer.durationBillingCycles,
    afterIntroPricing: offer.afterIntroPricing,
    percentUpgradePolicy: offer.percentUpgradePolicy,
    amountUpgradePolicy: offer.amountUpgradePolicy,
    fixedUpgradePolicy: offer.fixedUpgradePolicy,
    fixedReplacementPrices: offer.fixedReplacementPrices,
    fixedUpgradeFallback: offer.fixedUpgradeFallback,
    whiteGloveMode: offer.whiteGloveMode,
    whiteGloveAmountCents: offer.whiteGloveAmountCents,
    expiresAt: offer.expiresAt,
    replacesStandardPromos: offer.replacesStandardPromos,
    standardDiscountEligibility: offer.standardDiscountEligibility,
    standardDiscountEvidence: offer.standardDiscountEvidence,
  });
  const preview = validated.ok
    ? computeSalesOfferPreview(validated.normalized)
    : null;
  return {
    status: offer.status,
    venueName,
    recipientName: offer.recipientName,
    recipientEmail: offer.recipientEmail,
    customerMessage: offer.customerMessage,
    expiresAt: offer.expiresAt,
    preview,
    // Never expose internal notes / CRM ids beyond opaque token path.
  };
}

export function checkoutIdempotencyKey(snapshot: SalesOfferAcceptedSnapshot): string {
  return createHash("sha256")
    .update(
      `sales-offer-checkout:${snapshot.offerId}:${snapshot.revision}:${snapshot.termsHash}`,
    )
    .digest("hex")
    .slice(0, 48);
}

export function parseAcceptedSnapshot(
  raw: Record<string, unknown> | null | undefined,
): SalesOfferAcceptedSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.offerId !== "string" || typeof raw.termsHash !== "string") {
    return null;
  }
  if (typeof raw.monthlyRecurringCents !== "number") return null;
  return raw as unknown as SalesOfferAcceptedSnapshot;
}
