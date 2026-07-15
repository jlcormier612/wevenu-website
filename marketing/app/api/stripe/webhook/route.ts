import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { getStripe } from "@/lib/stripe/config";

export const runtime = "nodejs";

/**
 * Stripe webhook for Wevenu SaaS subscription lifecycle.
 * Configure this endpoint in the Stripe Dashboard (platform account).
 *
 * Handled events:
 * - checkout.session.completed
 * - customer.subscription.created / updated / deleted
 * - invoice.paid / invoice.payment_failed
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET is not configured." },
      { status: 500 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid signature.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      console.info("[stripe] checkout.session.completed", {
        id: session.id,
        customer: session.customer,
        subscription: session.subscription,
        plan: session.metadata?.wevenu_plan,
      });
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      console.info(`[stripe] ${event.type}`, {
        id: subscription.id,
        customer: subscription.customer,
        status: subscription.status,
        plan: subscription.metadata?.wevenu_plan,
      });
      break;
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      console.info(`[stripe] ${event.type}`, {
        id: invoice.id,
        customer: invoice.customer,
        amount_due: invoice.amount_due,
        status: invoice.status,
      });
      break;
    }
    default:
      console.info(`[stripe] unhandled event ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
