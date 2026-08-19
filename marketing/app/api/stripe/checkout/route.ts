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
import { fetchActiveVenueLegalDocuments } from "@/lib/legal/product-legal";
import { syncCheckoutStartedToRelationship } from "@/lib/relationships/bridge";
import {
  getCheckoutPricingForPlan,
  getMarketingSiteUrl,
  getOnboardingAddonPriceId,
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
 * - relationship_id (Path 2 — Send Subscription Link from Relationship Workspace)
 * - legal_accepted / legal document ids / accept IP+UA (public pricing flow)
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
      /** Subscriber's own name — collected at checkout, never derived from Stripe's billing name. */
      first_name?: string;
      last_name?: string;
      /** Existing Relationship — Path 2 subscription link */
      relationship_id?: string;
      customer_email?: string;
      /** Prefer Stripe customer when re-linking */
      stripe_customer_id?: string;
      /** Required for public Pricing checkout (not Path 2 CRM links). */
      legal_accepted?: unknown;
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
    const firstName = body.first_name?.trim() || "";
    const lastName = body.last_name?.trim() || "";
    const planName = getPlanDisplayName(plan);
    const relationshipId = body.relationship_id?.trim() || "";
    const customerEmail = body.customer_email?.trim() || "";
    const isPath2 = Boolean(relationshipId);
    const legalAccepted =
      body.legal_accepted === true ||
      body.legal_accepted === "true" ||
      body.legal_accepted === 1 ||
      body.legal_accepted === "1";

    // Public Pricing flow must accept Venue ToS + Privacy before Checkout.
    // Path 2 (CRM Send Subscription Link) keeps prior behavior (no blocking).
    if (!isPath2 && !legalAccepted) {
      return NextResponse.json(
        {
          error:
            "Please agree to the Terms of Service and Privacy Policy to continue.",
        },
        { status: 400 },
      );
    }

    // Public Pricing flow must collect the subscriber's own name and the
    // venue's name directly — never Stripe's billing "Name" field, which is
    // one combined string and may not even be the venue's name at all (a
    // person can type anything there). Path 2 (CRM link) already has this
    // data from the Relationship record, so it isn't blocked here.
    if (!isPath2 && (!venueName || !firstName || !lastName)) {
      return NextResponse.json(
        {
          error: "Please tell us your venue's name and your name to continue.",
        },
        { status: 400 },
      );
    }

    const stripe = getStripe();
    const pricing = getCheckoutPricingForPlan(plan, { founder: founderActive });
    const siteUrl = getMarketingSiteUrl();

    const forwardedFor = request.headers.get("x-forwarded-for");
    const legalIp = forwardedFor
      ? forwardedFor.split(",")[0]?.trim() || ""
      : request.headers.get("x-real-ip")?.trim() || "";
    const legalUa = request.headers.get("user-agent")?.trim() || "";
    const legalAcceptedAt = new Date().toISOString();

    const activeLegal = legalAccepted
      ? await fetchActiveVenueLegalDocuments()
      : null;

    const metadata: Record<string, string> = {
      plan_tier: plan,
      plan_name: planName,
      /** Legacy alias — same as plan_tier */
      wevenu_plan: plan,
      welcome_back: welcomeBack ? "true" : "false",
      onboarding_type: onboardingType,
      founding_member: foundingMember ? "true" : "false",
      pricing_mode: pricing.mode,
    };
    if (venueName) {
      metadata.venue_name = venueName;
    }
    if (firstName) {
      metadata.owner_first_name = firstName;
    }
    if (lastName) {
      metadata.owner_last_name = lastName;
    }
    if (relationshipId) {
      metadata.relationship_id = relationshipId;
    }
    if (legalAccepted) {
      metadata.legal_accepted = "true";
      metadata.legal_accepted_at = legalAcceptedAt;
      if (legalIp) metadata.legal_accept_ip = legalIp.slice(0, 128);
      if (legalUa) metadata.legal_accept_ua = legalUa.slice(0, 512);
      if (activeLegal?.venueTermsOfServiceId) {
        metadata.legal_tos_document_id = activeLegal.venueTermsOfServiceId;
      }
      if (activeLegal?.privacyPolicyId) {
        metadata.legal_privacy_document_id = activeLegal.privacyPolicyId;
      }
    }

    const lineItems: { price: string; quantity: number }[] = [
      { price: pricing.priceId, quantity: 1 },
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

    const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      mode: "subscription",
      line_items: lineItems,
      success_url: `${siteUrl}/pricing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: relationshipId
        ? `${siteUrl}/pricing?canceled=1&relationship_id=${encodeURIComponent(relationshipId)}`
        : `${siteUrl}/pricing?canceled=1`,
      // Stripe forbids allow_promotion_codes together with discounts.
      ...(pricing.foundingCouponId
        ? { discounts: [{ coupon: pricing.foundingCouponId }] }
        : { allow_promotion_codes: pricing.allowPromotionCodes }),
      billing_address_collection: "required",
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
      subscription_data: {
        metadata,
      },
      metadata,
    };

    // Subscription mode always creates/uses a Customer — `customer_creation`
    // is payment-mode only and Stripe rejects it here.
    if (body.stripe_customer_id?.trim()) {
      sessionParams.customer = body.stripe_customer_id.trim();
    } else if (customerEmail) {
      sessionParams.customer_email = customerEmail;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (!session.url) {
      return NextResponse.json(
        { error: "Unable to start checkout." },
        { status: 500 },
      );
    }

    // Draft / link relationship when we have venue, email, or existing relationship id.
    await syncCheckoutStartedToRelationship({
      email: customerEmail || null,
      venueName: venueName || null,
      plan,
      planName,
      welcomeBack,
      onboardingType,
      checkoutSessionId: session.id,
    });

    return NextResponse.json({
      url: session.url,
      session_id: session.id,
      welcome_back: welcomeBack,
      onboarding_type: onboardingType,
      founding_member: foundingMember,
      relationship_id: relationshipId || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
