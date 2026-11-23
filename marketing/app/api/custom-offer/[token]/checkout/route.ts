import { NextResponse } from "next/server";

import {
  buildAcceptedSnapshot,
  canAcceptOffer,
  checkoutIdempotencyKey,
  ensureSalesOfferCoupon,
  ensureSalesOfferWhiteGlovePrice,
  isOfferExpired,
  normalizeOfferEmail,
  parseAcceptedSnapshot,
  salesOfferCouponSpec,
  salesOfferOnboardingType,
  salesOfferWhiteGloveChargeCents,
  type SalesOfferAcceptedSnapshot,
} from "@shared/pricing";
import { getSalesOfferStore } from "@shared/pricing/sales-offer-store-access";
import { loadLiveStore } from "@shared/relationships";
import { getPlanDisplayName } from "@/lib/marketing/onboarding-packages";
import {
  getCheckoutPricingForPlan,
  getMarketingSiteUrl,
  getOnboardingAddonPriceId,
  getStripe,
  isSubscriptionPlanId,
} from "@/lib/stripe/config";

export const runtime = "nodejs";

type Params = { params: Promise<{ token: string }> };

/**
 * Create Stripe Checkout from the immutable accepted snapshot.
 * Accepts first if needed (when client posts accept+checkout together).
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const { token: raw } = await params;
    const token = raw?.trim() || "";
    if (!token || token.length < 32) {
      return NextResponse.json({ error: "Offer not found." }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const store = getSalesOfferStore();
    let offer = await store.getByPublicToken(token);
    if (!offer) {
      return NextResponse.json({ error: "Offer not found." }, { status: 404 });
    }

    const gate = canAcceptOffer(offer);
    if (!gate.ok) {
      return NextResponse.json(
        { error: gate.message, code: gate.code },
        { status: 409 },
      );
    }
    if (isOfferExpired(offer)) {
      return NextResponse.json(
        {
          error:
            "This offer has expired. Please contact Hello to Cheers for a new offer.",
          code: "offer_expired",
        },
        { status: 409 },
      );
    }

    let venueName = "your venue";
    let stripeCustomerId: string | null = null;
    try {
      const live = await loadLiveStore();
      const rel = live.relationships.find((r) => r.id === offer!.relationshipId);
      if (rel?.venue?.name) venueName = rel.venue.name;
      stripeCustomerId = rel?.stripeCustomerId?.trim() || null;
    } catch {
      // optional
    }

    let snapshot: SalesOfferAcceptedSnapshot | null = parseAcceptedSnapshot(
      offer.acceptedSnapshot,
    );

    if (!snapshot) {
      if (body.accept !== true) {
        return NextResponse.json(
          {
            error: "Accept the offer terms before checkout.",
            code: "acceptance_required",
          },
          { status: 400 },
        );
      }
      const recipientEmail =
        normalizeOfferEmail(offer.recipientEmail) ||
        normalizeOfferEmail(
          typeof body.recipientEmail === "string" ? body.recipientEmail : null,
        );
      const recipientName =
        offer.recipientName?.trim() ||
        (typeof body.recipientName === "string"
          ? body.recipientName.trim()
          : "") ||
        "Customer";
      if (!recipientEmail) {
        return NextResponse.json(
          { error: "Valid recipient email required.", code: "recipient_email" },
          { status: 400 },
        );
      }
      const acceptedAt = new Date().toISOString();
      const built = buildAcceptedSnapshot({
        offer,
        venueName,
        recipientName,
        recipientEmail,
        acceptedAt,
      });
      if ("error" in built) {
        return NextResponse.json({ error: built.error }, { status: 400 });
      }
      offer = await store.markAccepted({
        offerId: offer.id,
        acceptedSnapshot: built as unknown as Record<string, unknown>,
        acceptedRevision: offer.revision,
      });
      snapshot = built;
    }

    if (!isSubscriptionPlanId(snapshot.planKey)) {
      return NextResponse.json({ error: "Invalid plan on offer." }, { status: 400 });
    }

    // Resume existing open Checkout Session when still pending.
    if (
      offer.status === "checkout_pending" &&
      offer.checkoutSessionId &&
      body.forceNew !== true
    ) {
      try {
        const stripe = getStripe();
        const existing = await stripe.checkout.sessions.retrieve(
          offer.checkoutSessionId,
        );
        if (
          existing.status === "open" &&
          typeof existing.url === "string" &&
          existing.url
        ) {
          return NextResponse.json({
            ok: true,
            url: existing.url,
            sessionId: existing.id,
            resumed: true,
            expectedMonthlyCents: snapshot.monthlyRecurringCents,
            expectedWhiteGloveCents: salesOfferWhiteGloveChargeCents(snapshot),
          });
        }
      } catch {
        // fall through to create a new session
      }
    }

    const stripe = getStripe();
    const siteUrl = getMarketingSiteUrl();

    // Standard list Price only — Custom Offer coupon replaces standard promos.
    const pricing = getCheckoutPricingForPlan(snapshot.planKey, {
      launch: {
        earnedFoundingVenueCount: 10_000,
        programActive: false,
        venueAlreadyEarnedFounding: true,
        wevenDeclared: false,
        wevenVerified: false,
        groupEligible: false,
        honorFoundingIssued: false,
      },
    });

    const couponSpec = salesOfferCouponSpec(snapshot);
    let couponId: string | null = null;
    if (couponSpec) {
      couponId = await ensureSalesOfferCoupon({
        stripe,
        spec: couponSpec,
        offerId: snapshot.offerId,
      });
    }

    const onboardingType = salesOfferOnboardingType(snapshot);
    const wgCharge = salesOfferWhiteGloveChargeCents(snapshot);

    const lineItems: Array<{ price: string; quantity: number }> = [
      { price: pricing.priceId, quantity: 1 },
    ];

    let whiteGlovePriceId: string | null = null;
    if (onboardingType === "white_glove" && wgCharge > 0) {
      if (
        snapshot.whiteGloveMode === "standard_499" ||
        snapshot.whiteGloveMode === "weven_399"
      ) {
        const envName =
          snapshot.whiteGloveMode === "weven_399"
            ? "STRIPE_PRICE_WHITE_GLOVE_WEVEN"
            : "STRIPE_PRICE_WHITE_GLOVE";
        whiteGlovePriceId = getOnboardingAddonPriceId(envName);
        if (!whiteGlovePriceId && snapshot.whiteGloveMode === "weven_399") {
          whiteGlovePriceId = getOnboardingAddonPriceId("STRIPE_PRICE_WHITE_GLOVE");
        }
      }
      if (!whiteGlovePriceId) {
        const planPrice = await stripe.prices.retrieve(pricing.priceId);
        const productId =
          typeof planPrice.product === "string"
            ? planPrice.product
            : planPrice.product.id;
        // Prefer dedicated WG product when configured.
        let wgProductId = productId;
        const wgStandard = getOnboardingAddonPriceId("STRIPE_PRICE_WHITE_GLOVE");
        if (wgStandard) {
          try {
            const wgPrice = await stripe.prices.retrieve(wgStandard);
            wgProductId =
              typeof wgPrice.product === "string"
                ? wgPrice.product
                : wgPrice.product.id;
          } catch {
            // keep plan product
          }
        }
        whiteGlovePriceId = await ensureSalesOfferWhiteGlovePrice({
          stripe,
          productId: wgProductId,
          amountCents: wgCharge,
          offerId: snapshot.offerId,
          revision: snapshot.revision,
        });
      }
      if (whiteGlovePriceId) {
        lineItems.push({ price: whiteGlovePriceId, quantity: 1 });
      }
    }

    const planName = getPlanDisplayName(snapshot.planKey);
    const metadata: Record<string, string> = {
      plan_tier: snapshot.planKey,
      plan_name: planName,
      htc_plan: snapshot.planKey,
      welcome_back: "false",
      weven_declared: "false",
      onboarding_type: onboardingType,
      founding_member: "false",
      pricing_mode: "custom_sales_offer",
      applied_offer_type: "sales_offer",
      sales_offer_id: snapshot.offerId,
      sales_offer_revision: String(snapshot.revision),
      sales_offer_terms_hash: snapshot.termsHash,
      list_amount_cents: String(snapshot.listAmountCents),
      expected_recurring_amount_cents: String(snapshot.monthlyRecurringCents),
      relationship_id: snapshot.relationshipId,
      venue_name: snapshot.venueName || venueName,
      owner_first_name: snapshot.recipientName.split(/\s+/)[0] || "",
      owner_last_name:
        snapshot.recipientName.split(/\s+/).slice(1).join(" ") || "",
    };
    if (whiteGlovePriceId) {
      metadata.white_glove_price_id = whiteGlovePriceId;
    }
    if (wgCharge > 0) {
      metadata.expected_white_glove_cents = String(wgCharge);
    }

    const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] =
      {
        mode: "subscription",
        line_items: lineItems,
        success_url: `${siteUrl}/custom-offer/${token}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/custom-offer/${token}?canceled=1`,
        ...(couponId
          ? { discounts: [{ coupon: couponId }] }
          : { allow_promotion_codes: false }),
        billing_address_collection: "required",
        automatic_tax: { enabled: true },
        tax_id_collection: { enabled: true },
        subscription_data: { metadata },
        metadata,
        client_reference_id: snapshot.offerId.slice(0, 200),
      };

    if (stripeCustomerId) {
      sessionParams.customer = stripeCustomerId;
      sessionParams.customer_update = { name: "auto", address: "auto" };
    } else {
      sessionParams.customer_email = snapshot.recipientEmail;
    }

    const session = await stripe.checkout.sessions.create(sessionParams, {
      idempotencyKey: checkoutIdempotencyKey(snapshot),
    });

    await store.markCheckoutPending({
      offerId: offer.id,
      checkoutSessionId: session.id,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a Checkout URL." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      url: session.url,
      sessionId: session.id,
      resumed: false,
      expectedMonthlyCents: snapshot.monthlyRecurringCents,
      expectedWhiteGloveCents: wgCharge,
      expectedInitialCents: snapshot.monthlyRecurringCents + wgCharge,
    });
  } catch (error) {
    console.error("[custom-offer/checkout]", error);
    const message =
      error instanceof Error ? error.message : "Checkout failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
