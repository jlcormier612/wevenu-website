import { NextResponse } from "next/server";

import { getEnrollmentConfig, isFounderPricingActive } from "@/lib/marketing/enrollment";
import { isSubscriptionPlanId } from "@/lib/stripe/config";
import {
  getPaymentLinkEnvName,
  getPaymentLinkUrl,
  type PaymentLinkTier,
} from "@/lib/stripe/payment-links";

export const runtime = "nodejs";

/**
 * Resolve a preconfigured Stripe Payment Link URL (ops / legacy).
 *
 * Public Pricing checkout uses Checkout Sessions (`/api/stripe/checkout`) so
 * per-customer metadata like `welcome_back` can be set at purchase.
 * Welcome Back Payment Links are not used as a pre-purchase gate.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { plan?: string };
    const plan = body.plan;

    if (!plan || !isSubscriptionPlanId(plan)) {
      return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
    }

    const enrollment = getEnrollmentConfig();
    const tier: PaymentLinkTier = isFounderPricingActive(enrollment)
      ? "founder"
      : "standard";

    const url = getPaymentLinkUrl(plan, tier);
    if (!url) {
      const envName = getPaymentLinkEnvName(plan, tier);
      return NextResponse.json(
        {
          error: `Payment link is not configured yet (${envName}).`,
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ url, tier });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to resolve payment link.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
