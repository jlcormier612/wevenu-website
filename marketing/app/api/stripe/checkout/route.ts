import { NextResponse } from "next/server";

import {
  getEnrollmentConfig,
  isAutomaticFoundingMember,
  isFounderPricingActive,
  parseOnboardingType,
  parseWelcomeBackRequested,
} from "@/lib/marketing/enrollment";
import {
  getOnboardingPackage,
  getPlanDisplayName,
} from "@/lib/marketing/onboarding-packages";
import { syncCheckoutStartedToRelationship } from "@/lib/relationships/bridge";
import {
  getMarketingSiteUrl,
  getOnboardingAddonPriceId,
  getPriceIdForPlan,
  getStripe,
  isSubscriptionPlanId,
} from "@/lib/stripe/config";

export const runtime = "nodejs";

/**
 * Create a Stripe Checkout Session for a Hello to Cheers SaaS subscription.
 * Single session: plan subscription + optional onboarding one-time add-on.
 *
 * Metadata:
 * - venue_name
 * - plan_name / plan_tier
 * - founding_member: "true" | "false"
 * - welcome_back: "true" | "false"
 * - onboarding_type: self_guided | white_glove
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      plan?: string;
      welcome_back?: unknown;
      /** @deprecated Prefer welcome_back — still accepted for older clients */
      welcome_back_requested?: unknown;
      onboarding_type?: string;
      venue_name?: string;
    };
    const plan = body.plan;

    if (!plan || !isSubscriptionPlanId(plan)) {
      return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
    }

    const enrollment = getEnrollmentConfig();
    const founderActive = isFounderPricingActive(enrollment);
    const foundingMember = isAutomaticFoundingMember(enrollment);
    const welcomeBack = parseWelcomeBackRequested(
      body.welcome_back ?? body.welcome_back_requested,
    );
    const onboardingType = parseOnboardingType(body.onboarding_type);
    const onboardingPackage = getOnboardingPackage(onboardingType);
    const venueName = body.venue_name?.trim() || "";
    const planName = getPlanDisplayName(plan);

    const stripe = getStripe();
    const priceId = getPriceIdForPlan(plan, { founder: founderActive });
    const siteUrl = getMarketingSiteUrl();

    const metadata: Record<string, string> = {
      plan_tier: plan,
      plan_name: planName,
      /** Legacy alias — same as plan_tier */
      wevenu_plan: plan,
      welcome_back: welcomeBack ? "true" : "false",
      onboarding_type: onboardingType,
      founding_member: foundingMember ? "true" : "false",
    };
    if (venueName) {
      metadata.venue_name = venueName;
    }

    const lineItems: { price: string; quantity: number }[] = [
      { price: priceId, quantity: 1 },
    ];

    if (onboardingPackage.stripePriceEnv) {
      const addonPriceId = getOnboardingAddonPriceId(onboardingPackage.stripePriceEnv);
      if (!addonPriceId) {
        return NextResponse.json(
          { error: `${onboardingPackage.stripePriceEnv} is not configured.` },
          { status: 503 },
        );
      }
      lineItems.push({ price: addonPriceId, quantity: 1 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: lineItems,
      success_url: `${siteUrl}/pricing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/pricing?canceled=1`,
      allow_promotion_codes: true,
      billing_address_collection: "required",
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
      customer_creation: "always",
      subscription_data: {
        metadata,
      },
      metadata,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Unable to start checkout." },
        { status: 500 },
      );
    }

    // Optional draft relationship when we have a venue name (email comes later from Stripe).
    await syncCheckoutStartedToRelationship({
      venueName: venueName || null,
      plan,
      planName,
      welcomeBack,
      onboardingType,
      checkoutSessionId: session.id,
    });

    return NextResponse.json({
      url: session.url,
      welcome_back: welcomeBack,
      onboarding_type: onboardingType,
      founding_member: foundingMember,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
