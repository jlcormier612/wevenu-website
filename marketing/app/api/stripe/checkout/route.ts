import { NextResponse } from "next/server";

import {
  getEnrollmentConfig,
  getEnrollmentConfigAsync,
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
import { authorizeCrmAssistedCheckout } from "@/lib/stripe/crm-checkout-auth";
import { resolveCrmCheckoutPrivileges } from "@/lib/stripe/crm-checkout-privileges";
import {
  getCheckoutPricingForPlan,
  getMarketingSiteUrl,
  getOnboardingAddonPriceId,
  getStripe,
  isSubscriptionPlanId,
} from "@/lib/stripe/config";
import {
  FOUNDING_PERCENT_OFF,
  GROUP_PERCENT_OFF,
  WEVEN_PERCENT_OFF,
  abandonIssuedOfferOnStripeFailure,
  getPricingGroupV1Readiness,
  getPricingLaunchOperationalSignal,
  getPricingLaunchV1Readiness,
  getPricingWevenOperationalSignal,
  getPricingWevenV1Readiness,
  isPricingGroupV1Ready,
  isPricingLaunchV1Ready,
  isPricingWevenV1Misconfigured,
  isPricingWevenV1Ready,
  requireDurablePricingOfferStore,
  resolveReservationGroupEligibility,
} from "@shared/pricing";
import { requireDurableGroupOrgStore } from "@shared/pricing/group-org-store-access";
import { createCrmAdminClient } from "@shared/relationships/pg-client";

export const runtime = "nodejs";

/**
 * Create a Stripe Checkout Session for a Hello to Cheers SaaS subscription.
 * Single session: plan subscription + optional onboarding one-time add-on.
 *
 * Authorization:
 * - Public marketing Checkout (anonymous prospects): email / new Customer only.
 *   Client-supplied Stripe Customer IDs and relationship IDs are ignored for
 *   Customer reuse and Path-2 privileges.
 * - CRM-assisted Checkout (Send Subscription Link): workspace authenticates the
 *   operator, then calls this endpoint with Bearer PRODUCT_SYNC_API_KEY. Only
 *   then may an existing Stripe Customer be reused and relationship_id bound.
 *
 * Metadata:
 * - venue_name
 * - plan_name / plan_tier
 * - founding_member: "true" | "false"
 * - welcome_back: "true" | "false"
 * - onboarding_type: self_guided | white_glove
 * - relationship_id (CRM-assisted only)
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
      first_name?: string;
      last_name?: string;
      /** Existing Relationship — CRM-assisted subscription link only */
      relationship_id?: string;
      customer_email?: string;
      /** Prefer Stripe customer when CRM-assisted re-linking */
      stripe_customer_id?: string;
      /** Required for public Pricing checkout (not CRM-assisted). */
      legal_accepted?: unknown;
      /**
       * Phase 4 Add Another Venue reservation. Server resolves group eligibility
       * from this durable id — never trust a client `groupEligible` flag.
       */
      organization_reservation_id?: string;
    };
    const plan = body.plan;

    if (!plan || !isSubscriptionPlanId(plan)) {
      return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
    }

    const crmAssisted = authorizeCrmAssistedCheckout(request);

    const launchReadiness = getPricingLaunchV1Readiness();
    if (launchReadiness.mode === "v1_misconfigured") {
      const signal = getPricingLaunchOperationalSignal();
      console.error("[checkout] Pricing Launch V1 misconfigured — refusing Checkout", {
        mode: signal.mode,
        missing: signal.missing,
        message: signal.message,
        crmAssisted,
      });
      return NextResponse.json(
        {
          error:
            "Subscription checkout is temporarily unavailable. Pricing Launch V1 is enabled but incomplete.",
          code: "pricing_launch_misconfigured",
          missing: signal.missing,
        },
        { status: 503 },
      );
    }

    const launchReady = isPricingLaunchV1Ready(launchReadiness);
    const wevenReadiness = getPricingWevenV1Readiness();
    const wevenReady = isPricingWevenV1Ready(wevenReadiness);
    const enrollment = launchReady
      ? await getEnrollmentConfigAsync()
      : getEnrollmentConfig();
    const founderActive = isFounderPricingActive(enrollment);
    const welcomeBack = parseWelcomeBackRequested(
      body.welcome_back ?? body.welcome_back_requested,
    );
    // Explicit self-declaration only. When Phase 2 is ready, welcome_back drives
    // the Weven 20% Checkout path. When Phase 2 is off, it remains a CRM flag.
    const wevenDeclared = welcomeBack && wevenReady;
    if (welcomeBack && isPricingWevenV1Misconfigured(wevenReadiness)) {
      const signal = getPricingWevenOperationalSignal();
      console.error("[checkout] Weven Phase 2 misconfigured — refusing Weven Checkout", {
        missing: signal.missing,
        message: signal.message,
      });
      return NextResponse.json(
        {
          error:
            "Former Weven checkout is temporarily unavailable. Please continue without the Weven option, or contact us for help.",
          code: "pricing_weven_misconfigured",
          missing: signal.missing,
        },
        { status: 503 },
      );
    }
    const onboardingType = parseOnboardingType(body.onboarding_type);
    const onboardingPackage = getOnboardingPackage(onboardingType);
    const venueName = body.venue_name?.trim() || "";
    const ownerFirstName = body.first_name?.trim() || "";
    const ownerLastName = body.last_name?.trim() || "";
    const planName = getPlanDisplayName(plan);
    const customerEmail = body.customer_email?.trim() || "";

    // Relationship + existing Stripe Customer are only trusted when the caller
    // proved CRM-assisted authorization. Public callers may still supply an
    // email for a new Customer.
    const privileges = resolveCrmCheckoutPrivileges({
      crmAssisted,
      relationshipId: body.relationship_id,
      stripeCustomerId: body.stripe_customer_id,
    });
    const { relationshipId, stripeCustomerId, isPath2 } = privileges;

    // Reject unauthenticated attempts to force Customer reuse explicitly so
    // callers cannot rely on silent ignore as success.
    if (privileges.rejectedUnauthCustomerReuse) {
      return NextResponse.json(
        { error: "Existing Stripe Customer reuse requires CRM authorization." },
        { status: 403 },
      );
    }

    const legalAccepted =
      body.legal_accepted === true ||
      body.legal_accepted === "true" ||
      body.legal_accepted === 1 ||
      body.legal_accepted === "1";

    // Public Pricing flow must accept Venue ToS + Privacy before Checkout.
    // CRM-assisted Path 2 keeps prior behavior (no blocking).
    if (!isPath2 && !legalAccepted) {
      return NextResponse.json(
        {
          error:
            "Please agree to the Terms of Service and Privacy Policy to continue.",
        },
        { status: 400 },
      );
    }

    // Public Pricing flow must collect distinct subscriber first/last name and
    // venue name at checkout — never derived later from Stripe's billing name.
    // CRM-assisted Path 2 already carries these on the Relationship.
    if (!isPath2 && (!venueName || !ownerFirstName || !ownerLastName)) {
      return NextResponse.json(
        {
          error: "Please tell us your venue's name and your name to continue.",
        },
        { status: 400 },
      );
    }

    const stripe = getStripe();
    let offerStore: ReturnType<typeof requireDurablePricingOfferStore> | null =
      null;
    if (launchReady) {
      try {
        offerStore = requireDurablePricingOfferStore();
        if (!offerStore.durable) {
          throw new Error(
            "Pricing Launch V1 requires durable Postgres offer persistence.",
          );
        }
      } catch (storeError) {
        const message =
          storeError instanceof Error ? storeError.message : String(storeError);
        console.error("[checkout] durable pricing store unavailable", {
          message,
        });
        return NextResponse.json(
          {
            error:
              "Subscription checkout is temporarily unavailable. Durable pricing persistence is not configured.",
            code: "pricing_offer_store_unavailable",
          },
          { status: 503 },
        );
      }
    }

    const earnedFoundingCount =
      launchReady && offerStore
        ? (enrollment.foundingEarnedCount ??
          (await offerStore.countEarnedFoundingVenues()))
        : 0;

    // Phase 4 — server-authoritative group eligibility from durable reservation.
    let groupEligible = false;
    let organizationReservationId: string | null = null;
    const reservationIdRaw = body.organization_reservation_id?.trim() || "";
    if (reservationIdRaw) {
      const groupReadiness = getPricingGroupV1Readiness();
      if (groupReadiness.mode === "group_misconfigured") {
        return NextResponse.json(
          {
            error:
              "Organization group pricing is temporarily unavailable. Please try again shortly.",
            code: "pricing_group_misconfigured",
            missing: groupReadiness.missing,
          },
          { status: 503 },
        );
      }
      if (!isPricingGroupV1Ready(groupReadiness)) {
        return NextResponse.json(
          {
            error:
              "Organization group pricing is not active yet. Contact support to add another venue.",
            code: "pricing_group_disabled",
          },
          { status: 503 },
        );
      }
      try {
        const orgStore = requireDurableGroupOrgStore();
        const admin = createCrmAdminClient();
        const resolved = await resolveReservationGroupEligibility({
          store: orgStore,
          reservationId: reservationIdRaw,
          loadMemberBilling: async (venueIds) => {
            if (venueIds.length === 0) return [];
            const { data } = await admin
              .from("venues")
              .select(
                "id, saas_plan_key, saas_subscription_status, saas_stripe_subscription_id",
              )
              .in("id", venueIds);
            return (data ?? []).map((v) => ({
              venueId: v.id as string,
              planKey: ((v.saas_plan_key as string) ||
                "starter") as "starter" | "growing" | "professional",
              subscriptionStatus:
                (v.saas_subscription_status as string | null) ?? null,
              stripeSubscriptionId:
                (v.saas_stripe_subscription_id as string | null) ?? null,
            }));
          },
        });
        groupEligible = resolved.groupEligibleForCheckout;
        organizationReservationId = resolved.reservation.id;
      } catch (reservationError) {
        const message =
          reservationError instanceof Error
            ? reservationError.message
            : String(reservationError);
        console.error("[checkout] organization reservation resolve failed", {
          reservationId: reservationIdRaw,
          message,
        });
        return NextResponse.json(
          {
            error:
              "This Add Another Venue link is no longer valid. Return to Billing and try again.",
            code: "organization_reservation_invalid",
          },
          { status: 400 },
        );
      }
    }

    const pricing = launchReady
      ? getCheckoutPricingForPlan(plan, {
          launch: {
            earnedFoundingVenueCount: earnedFoundingCount,
            programActive: enrollment.founderProgramActive,
            wevenDeclared,
            groupEligible,
          },
        })
      : getCheckoutPricingForPlan(plan, { founder: founderActive });

    // Launch V1: founding eligibility comes from the issued offer (soft-100).
    // When Weven wins the applied coupon, foundingIssued can still be true for the grant.
    // Legacy: automatic founding while program spots remain.
    const foundingMember = launchReady
      ? Boolean(pricing.launch?.foundingIssued)
      : isAutomaticFoundingMember(enrollment);
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

    let checkoutOfferId: string | null = null;
    if (launchReady && pricing.launch && offerStore) {
      const issued = await offerStore.issueCheckoutOffer({
        planKey: plan,
        listAmountCents: pricing.launch.listAmountCents,
        stripePriceId: pricing.priceId,
        foundingIssued: pricing.launch.foundingIssued,
        foundingPercentOff: pricing.launch.foundingPercentOff,
        wevenDeclared: pricing.launch.wevenDeclared,
        wevenPercentOff: pricing.launch.wevenPercentOff,
        appliedOfferType: pricing.launch.appliedOfferType,
        stripeCouponId: pricing.foundingCouponId,
        whiteGlovePriceId:
          onboardingType === "white_glove"
            ? wevenDeclared
              ? pricing.launch.wevenWhiteGlovePriceId
              : getOnboardingAddonPriceId("STRIPE_PRICE_WHITE_GLOVE")
            : null,
        pricingVersion: pricing.launch.pricingVersion,
        relationshipId: relationshipId || null,
        stripeCustomerId: stripeCustomerId || null,
        ownerEmailNormalized: customerEmail
          ? customerEmail.trim().toLowerCase()
          : null,
        venueNameNormalized: venueName ? venueName.trim().toLowerCase() : null,
        earnedFoundingCountAtIssue: pricing.launch.earnedFoundingCountAtIssue,
      });
      checkoutOfferId = issued.id;
    }

    const metadata: Record<string, string> = {
      plan_tier: plan,
      plan_name: planName,
      htc_plan: plan,
      welcome_back: welcomeBack ? "true" : "false",
      weven_declared: wevenDeclared ? "true" : "false",
      onboarding_type: onboardingType,
      founding_member: foundingMember ? "true" : "false",
      pricing_mode: pricing.mode,
    };
    if (launchReady && pricing.launch) {
      metadata.pricing_version = pricing.launch.pricingVersion;
      metadata.founding_percent_off = foundingMember
        ? String(FOUNDING_PERCENT_OFF)
        : "0";
      metadata.weven_percent_off = wevenDeclared
        ? String(WEVEN_PERCENT_OFF)
        : "0";
      metadata.applied_offer_type = pricing.launch.appliedOfferType ?? "";
      metadata.list_amount_cents = String(pricing.launch.listAmountCents);
      metadata.expected_recurring_amount_cents = String(
        pricing.launch.expectedRecurringAmountCents,
      );
      metadata.group_eligible = groupEligible ? "true" : "false";
      metadata.group_percent_off = pricing.launch.groupPercentOff
        ? String(pricing.launch.groupPercentOff)
        : "0";
      if (organizationReservationId) {
        metadata.org_reservation_id = organizationReservationId;
      }
      if (checkoutOfferId) metadata.checkout_offer_id = checkoutOfferId;
    }
    if (venueName) {
      metadata.venue_name = venueName;
    }
    if (ownerFirstName) {
      metadata.owner_first_name = ownerFirstName;
    }
    if (ownerLastName) {
      metadata.owner_last_name = ownerLastName;
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
      // Weven White Glove uses a dedicated $399 Price so the 20% subscription
      // coupon (restricted via Stripe applies_to on plan products) does not
      // reduce the one-time onboarding charge.
      const addonEnv =
        wevenDeclared && onboardingPackage.id === "white_glove"
          ? "STRIPE_PRICE_WHITE_GLOVE_WEVEN"
          : onboardingPackage.stripePriceEnv;
      const addonPriceId = getOnboardingAddonPriceId(addonEnv);
      if (!addonPriceId) {
        return NextResponse.json(
          { error: `${addonEnv} is not configured.` },
          { status: 503 },
        );
      }
      lineItems.push({ price: addonPriceId, quantity: 1 });
      metadata.white_glove_price_id = addonPriceId;
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
    // Existing Customer + automatic_tax / tax_id_collection requires
    // customer_update so Checkout can save the entered billing address
    // onto the Customer (CRM-assisted re-link only). Email-only public
    // Checkout creates a fresh Customer and does not need this.
    if (stripeCustomerId) {
      sessionParams.customer = stripeCustomerId;
      sessionParams.customer_update = {
        name: "auto",
        address: "auto",
      };
    } else if (customerEmail) {
      sessionParams.customer_email = customerEmail;
    }

    let session: Awaited<
      ReturnType<typeof stripe.checkout.sessions.create>
    >;
    try {
      session = await stripe.checkout.sessions.create(sessionParams);
    } catch (stripeError) {
      if (offerStore && checkoutOfferId) {
        await abandonIssuedOfferOnStripeFailure(
          offerStore,
          checkoutOfferId,
          stripeError instanceof Error ? stripeError.message : "stripe_create_failed",
        );
      }
      throw stripeError;
    }

    if (!session.url) {
      if (offerStore && checkoutOfferId) {
        await abandonIssuedOfferOnStripeFailure(
          offerStore,
          checkoutOfferId,
          "session_missing_url",
        );
      }
      return NextResponse.json(
        { error: "Unable to start checkout." },
        { status: 500 },
      );
    }

    if (checkoutOfferId && offerStore) {
      try {
        await offerStore.attachCheckoutSession(checkoutOfferId, session.id);
      } catch (attachError) {
        // Session already carries checkout_offer_id in metadata for webhook recovery.
        console.error(
          "[checkout] failed to attach session to pricing offer",
          attachError,
        );
      }
    }

    if (organizationReservationId) {
      try {
        const orgStore = requireDurableGroupOrgStore();
        await orgStore.attachCheckoutSession({
          reservationId: organizationReservationId,
          stripeCheckoutSessionId: session.id,
          checkoutOfferId,
        });
      } catch (attachReservationError) {
        console.error(
          "[checkout] failed to attach session to organization reservation",
          attachReservationError,
        );
      }
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
      weven_declared: wevenDeclared,
      onboarding_type: onboardingType,
      founding_member: foundingMember,
      relationship_id: relationshipId || null,
      checkout_offer_id: checkoutOfferId,
      pricing_mode: pricing.mode,
      applied_offer_type: pricing.launch?.appliedOfferType ?? null,
      group_eligible: groupEligible,
      group_percent_off: pricing.launch?.groupPercentOff ?? null,
      expected_recurring_amount_cents:
        pricing.launch?.expectedRecurringAmountCents ?? null,
      org_reservation_id: organizationReservationId,
      list_amount_cents: pricing.launch?.listAmountCents ?? null,
      // Surface GROUP_PERCENT_OFF for UI when group wins (not when Weven/Founding wins).
      group_catalog_percent:
        pricing.launch?.appliedOfferType === "group_pct"
          ? GROUP_PERCENT_OFF
          : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
