import { NextResponse } from "next/server";

import {
  getMarketingSiteUrl,
  getPriceIdForPlan,
  getStripe,
  isSubscriptionPlanId,
} from "@/lib/stripe/config";

export const runtime = "nodejs";

/**
 * Create a Stripe Checkout Session for a Wevenu SaaS subscription.
 * Relies on Stripe-hosted Checkout (Apple Pay / Google Pay when enabled).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { plan?: string };
    const plan = body.plan;

    if (!plan || !isSubscriptionPlanId(plan)) {
      return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
    }

    const stripe = getStripe();
    const priceId = getPriceIdForPlan(plan);
    const siteUrl = getMarketingSiteUrl();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/pricing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/pricing?canceled=1`,
      allow_promotion_codes: true,
      billing_address_collection: "required",
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
      customer_creation: "always",
      subscription_data: {
        metadata: {
          wevenu_plan: plan,
        },
      },
      metadata: {
        wevenu_plan: plan,
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Unable to start checkout." },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
