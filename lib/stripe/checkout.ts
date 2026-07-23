/**
 * Hosted Checkout Session creation — Sprint 4, Venue Payment Processing.
 *
 * Called from the couple portal (app/api/portal/checkout/route.ts). The
 * portal has no Supabase Auth session (it authenticates via a token
 * validated inside a security-definer RPC — see lib/portal/service.ts and
 * supabase/migrations/20261136000000_stripe_portal_checkout_context.sql),
 * so this reads its context from that RPC rather than getCurrentVenue().
 *
 * Direct Charge equivalent for Hosted Checkout: the Session (and the
 * PaymentIntent/Charge it produces) is created directly on the venue's
 * connected account via the `stripeAccount` request option — Wevenu's own
 * Stripe account is never in the money's path.
 */
import type Stripe from "stripe";

import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/config";
import { ensureStripeCustomer } from "@/lib/stripe/customer";
import * as paymentsRepo from "@/lib/payments/repository";
import type { CreateCheckoutSessionResult } from "@/lib/stripe/types";

type PortalCheckoutContext = {
  venueId: string;
  clientId: string;
  stripeAccountId: string;
  chargesEnabled: boolean;
  acceptedPaymentMethods: ("card" | "us_bank_account")[];
  itemId: string;
  itemLabel: string;
  itemAmount: number;
  scheduleId: string;
  invoiceId: string | null;
  error?: string;
};

export async function createPortalCheckoutSession(token: string, itemId: string): Promise<CreateCheckoutSessionResult> {
  if (!isStripeConfigured()) return { ok: false, message: "Online payments aren't configured." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_portal_checkout_context", { p_token: token, p_item_id: itemId });
  if (error) return { ok: false, message: error.message };
  const ctx = data as PortalCheckoutContext;
  if (ctx.error === "invalid_token") return { ok: false, message: "This link has expired." };
  if (ctx.error === "not_permitted") return { ok: false, message: "Payments aren't available on this link." };
  if (ctx.error === "not_found") return { ok: false, message: "Payment not found." };
  if (ctx.error === "not_payable") return { ok: false, message: "This payment has already been handled." };
  if (ctx.error === "stripe_not_connected") return { ok: false, message: "Your venue hasn't connected online payments yet." };
  if (!ctx.chargesEnabled) return { ok: false, message: "Your venue's payment account isn't ready to accept charges yet." };

  const customerId = await ensureStripeCustomer(ctx.venueId, ctx.clientId, ctx.stripeAccountId);
  if (!customerId) return { ok: false, message: "Could not prepare checkout." };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const stripe = getStripeClient();

  const paymentMethodTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] =
    ctx.acceptedPaymentMethods.length > 0 ? ctx.acceptedPaymentMethods : ["card"];

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      customer: customerId,
      payment_method_types: paymentMethodTypes,
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: ctx.itemLabel },
          unit_amount: Math.round(ctx.itemAmount * 100),
        },
        quantity: 1,
      }],
      metadata: {
        wevenu_payment_line_item_id: ctx.itemId,
        wevenu_venue_id: ctx.venueId,
        wevenu_client_id: ctx.clientId,
        wevenu_schedule_id: ctx.scheduleId,
        wevenu_invoice_id: ctx.invoiceId ?? "",
      },
      // Copied onto the resulting PaymentIntent too — the webhook handler
      // keys off payment_intent.* events (card and ACH alike), not
      // checkout.session.completed, so it needs this metadata there.
      payment_intent_data: {
        metadata: {
          wevenu_payment_line_item_id: ctx.itemId,
          wevenu_venue_id: ctx.venueId,
          wevenu_client_id: ctx.clientId,
          wevenu_schedule_id: ctx.scheduleId,
          wevenu_invoice_id: ctx.invoiceId ?? "",
        },
      },
      success_url: `${appUrl}/p/${token}?payment=success`,
      cancel_url: `${appUrl}/p/${token}?payment=cancelled`,
    },
    { stripeAccount: ctx.stripeAccountId },
  );

  if (!session.url) return { ok: false, message: "Stripe did not return a checkout URL." };

  // Validated ownership above via the token-scoped RPC — safe to write via
  // the admin client (the portal has no session for the regular client).
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await paymentsRepo.setCheckoutSession(admin as any, ctx.venueId, ctx.itemId, session.id);

  return { ok: true, checkoutUrl: session.url };
}
