"use client";

import { useEffect } from "react";

import { trackPurchase, type PurchaseAnalyticsType } from "@shared/analytics";

type PurchaseAnalyticsProps = {
  /** Stripe Checkout Session id (`cs_…`) — transaction-level dedupe key. */
  transactionId: string;
  /** Must be true only after paid enrollment / Stripe payment verification. */
  paymentVerified: boolean;
  planId?: string | null;
  valueCents?: number | null;
  whiteGlove?: boolean;
  purchaseType?: PurchaseAnalyticsType;
};

/**
 * Consent-gated purchase conversion on success page.
 * Fires only when paymentVerified (enrollment after Stripe paid path).
 * Dedupes by Checkout Session id across refresh / repeat visits.
 * Never used for subscription renewals (those never hit this surface).
 */
export function PurchaseAnalytics({
  transactionId,
  paymentVerified,
  planId,
  valueCents,
  whiteGlove,
  purchaseType,
}: PurchaseAnalyticsProps) {
  useEffect(() => {
    const id = transactionId.trim();
    if (!id || !paymentVerified) return;
    trackPurchase({
      transaction_id: id,
      payment_verified: true,
      plan_id: planId || undefined,
      value_cents:
        typeof valueCents === "number" && valueCents > 0 ? valueCents : undefined,
      white_glove: whiteGlove === true,
      purchase_type:
        purchaseType ||
        (whiteGlove ? "subscription_with_white_glove" : "subscription"),
    });
  }, [
    transactionId,
    paymentVerified,
    planId,
    valueCents,
    whiteGlove,
    purchaseType,
  ]);

  return null;
}
