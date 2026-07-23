/**
 * Real Stripe refunds — Sprint 4, Venue Payment Processing, §6.4 (docs/
 * venue-payment-processing-architecture.md). refundLineItem_() in
 * lib/payments/service.ts branches on stripe_payment_intent_id presence:
 * this is the real-API path; TR-M3's original ledger-only path is
 * untouched when it's absent (a manually-recorded payment that never
 * went through Stripe).
 */
import { getStripeClient } from "@/lib/stripe/config";

export type StripeRefundResult =
  | { ok: true }
  | { ok: false; message: string };

export async function refundStripePayment(
  stripeAccountId: string,
  paymentIntentId: string,
  refundAmount: number,
): Promise<StripeRefundResult> {
  try {
    await getStripeClient().refunds.create(
      { payment_intent: paymentIntentId, amount: Math.round(refundAmount * 100) },
      { stripeAccount: stripeAccountId },
    );
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe refund failed.";
    return { ok: false, message };
  }
}
