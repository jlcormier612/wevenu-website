/**
 * Stripe Checkout / Setup for public tour protection.
 *
 * Separate from lib/stripe/checkout.ts, which requires an event payment
 * line item. Tour prospects are leads, not clients with invoices.
 */
import type Stripe from "stripe";

import { getStripeClient, isStripeConfigured } from "@/lib/stripe/config";
import { TOUR_PROTECTION_KIND } from "@/lib/tours/protection-rules";

export type TourProtectionCheckoutMode = "setup" | "fee";

export type CreateTourProtectionSessionInput = {
  stripeAccountId: string;
  requestId: string;
  venueId: string;
  leadId: string;
  embedKey: string;
  mode: TourProtectionCheckoutMode;
  feeCents: number;
  customerEmail: string;
  customerName: string;
  existingCustomerId?: string | null;
};

export type CreateTourProtectionSessionResult =
  | {
      ok: true;
      checkoutUrl: string;
      sessionId: string;
      customerId: string;
    }
  | { ok: false; message: string };

function protectionMetadata(input: CreateTourProtectionSessionInput): Record<string, string> {
  return {
    htc_payment_line_item_id: input.requestId,
    htc_kind: TOUR_PROTECTION_KIND,
    htc_venue_id: input.venueId,
    htc_lead_id: input.leadId,
    htc_tour_protection_request_id: input.requestId,
  };
}

async function ensureConnectedCustomer(
  stripe: Stripe,
  stripeAccountId: string,
  input: CreateTourProtectionSessionInput,
): Promise<string> {
  if (input.existingCustomerId) return input.existingCustomerId;

  if (input.customerEmail) {
    const existing = await stripe.customers.list(
      { email: input.customerEmail, limit: 1 },
      { stripeAccount: stripeAccountId },
    );
    if (existing.data[0]) return existing.data[0].id;
  }

  const customer = await stripe.customers.create(
    {
      name: input.customerName || undefined,
      email: input.customerEmail || undefined,
      metadata: {
        htc_lead_id: input.leadId,
        htc_venue_id: input.venueId,
        htc_tour_protection_request_id: input.requestId,
      },
    },
    { stripeAccount: stripeAccountId },
  );
  return customer.id;
}

export async function createTourProtectionCheckoutSession(
  input: CreateTourProtectionSessionInput,
): Promise<CreateTourProtectionSessionResult> {
  if (!isStripeConfigured()) return { ok: false, message: "Online payments aren't configured." };
  if (input.mode === "fee" && input.feeCents <= 0) {
    return { ok: false, message: "A tour fee amount is required." };
  }

  const stripe = getStripeClient();
  const customerId = await ensureConnectedCustomer(stripe, input.stripeAccountId, input);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const returnUrl = `${appUrl}/book/${input.embedKey}/protection?session_id={CHECKOUT_SESSION_ID}`;
  const metadata = protectionMetadata(input);

  const common: Stripe.Checkout.SessionCreateParams = {
    customer: customerId,
    payment_method_types: ["card"],
    metadata,
    success_url: returnUrl,
    cancel_url: returnUrl,
  };

  const session = input.mode === "setup"
    ? await stripe.checkout.sessions.create(
        {
          ...common,
          mode: "setup",
          setup_intent_data: { metadata },
        },
        { stripeAccount: input.stripeAccountId },
      )
    : await stripe.checkout.sessions.create(
        {
          ...common,
          mode: "payment",
          line_items: [{
            price_data: {
              currency: "usd",
              product_data: { name: "Venue tour fee" },
              unit_amount: input.feeCents,
            },
            quantity: 1,
          }],
          payment_intent_data: { metadata },
        },
        { stripeAccount: input.stripeAccountId },
      );

  if (!session.url) return { ok: false, message: "Could not start the payment step." };
  return { ok: true, checkoutUrl: session.url, sessionId: session.id, customerId };
}
