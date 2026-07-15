import { NextResponse } from "next/server";

import { getMarketingSiteUrl, getStripe } from "@/lib/stripe/config";

export const runtime = "nodejs";

/**
 * Open the Stripe Customer Portal for self-service billing
 * (update payment method, invoices, cancel anytime).
 *
 * Accepts either a Checkout `session_id` (preferred after purchase)
 * or an existing Stripe `customer_id`.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      session_id?: string;
      customer_id?: string;
    };

    const stripe = getStripe();
    const siteUrl = getMarketingSiteUrl();

    let customerId = body.customer_id?.trim() || null;

    if (!customerId && body.session_id) {
      const checkout = await stripe.checkout.sessions.retrieve(body.session_id);
      customerId =
        typeof checkout.customer === "string"
          ? checkout.customer
          : checkout.customer?.id ?? null;
    }

    if (!customerId) {
      return NextResponse.json(
        { error: "A customer is required to open the billing portal." },
        { status: 400 },
      );
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${siteUrl}/pricing`,
    });

    return NextResponse.json({ url: portal.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Portal failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
