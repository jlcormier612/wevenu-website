/**
 * Trusted server-side recovery when Checkout redirect arrives before the
 * webhook has written enrollment. Always re-reads the Session from Stripe —
 * never treats the success URL alone as proof of payment.
 */
import type Stripe from "stripe";

import { createVenueEnrollment } from "@/lib/crm/service";
import { findEnrollmentByCheckoutSessionId } from "@/lib/crm/store";
import {
  parseOnboardingType,
  parseWelcomeBackRequested,
} from "@/lib/marketing/enrollment";
import {
  getStripe,
  shouldProvisionFromCheckoutSession,
} from "@/lib/stripe/config";
import {
  getPricingOfferStore,
  isPricingLaunchV1Ready,
  requireDurablePricingOfferStore,
  shouldHonorIssuedFoundingOffer,
} from "@shared/pricing";

export type ReconcilePaidCheckoutResult =
  | { ok: true; status: "already_enrolled" }
  | { ok: true; status: "reconciled"; enrollmentId: string }
  | { ok: true; status: "not_eligible"; reason: string }
  | { ok: false; error: string };

function readWelcomeBackFromMeta(meta: Stripe.Metadata): boolean {
  return parseWelcomeBackRequested(
    meta.welcome_back ?? meta.welcome_back_requested,
  );
}

function readFoundingFromMeta(meta: Stripe.Metadata): boolean {
  const foundingFromMeta = meta.founding_member;
  if (foundingFromMeta != null) {
    return parseWelcomeBackRequested(foundingFromMeta);
  }
  // Match webhook: Launch V1 missing metadata ⇒ non-founding.
  if (isPricingLaunchV1Ready()) return false;
  return false;
}

async function resolveCustomerEmailAndVenue(
  stripe: Stripe,
  customerId: string | null,
  fallbackEmail: string | null,
  fallbackVenue: string,
): Promise<{ email: string | null; venueName: string }> {
  let customerEmail = fallbackEmail;
  let venueName = fallbackVenue;

  if (customerId && (!venueName || !customerEmail)) {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      if (!customer.deleted) {
        if (!customerEmail && customer.email) customerEmail = customer.email;
        if (!venueName) {
          venueName = customer.metadata?.venue_name?.trim() || "";
        }
      }
    } catch {
      // Keep fallbacks.
    }
  }

  if (!venueName) {
    venueName = customerEmail
      ? customerEmail.split("@")[0] || "Unknown venue"
      : "Unknown venue";
  }

  return { email: customerEmail, venueName };
}

/**
 * If Stripe says this Checkout Session is paid and enrollment is missing,
 * run the same enrollment/provision path the webhook uses (idempotent).
 */
export async function reconcilePaidCheckoutSession(
  sessionId: string,
): Promise<ReconcilePaidCheckoutResult> {
  const trimmed = sessionId.trim();
  if (!trimmed.startsWith("cs_")) {
    return { ok: false, error: "invalid_session_id" };
  }

  const existing = await findEnrollmentByCheckoutSessionId(trimmed);
  if (existing) {
    return { ok: true, status: "already_enrolled" };
  }

  const stripe = getStripe();
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(trimmed, {
      expand: ["subscription", "customer"],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Unknown / forged session ids must not look like "still confirming payment".
    if (/no such checkout\.session/i.test(message) || /resource_missing/i.test(message)) {
      return {
        ok: true,
        status: "not_eligible",
        reason: "stripe_session_not_found",
      };
    }
    return { ok: false, error: message };
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;

  let subscriptionStatus: string | null = null;
  if (subscriptionId) {
    try {
      const sub =
        typeof session.subscription === "object" && session.subscription
          ? session.subscription
          : await stripe.subscriptions.retrieve(subscriptionId);
      subscriptionStatus = sub.status;
    } catch {
      subscriptionStatus = null;
    }
  }

  if (
    !shouldProvisionFromCheckoutSession({
      paymentStatus: session.payment_status,
      subscriptionStatus,
    })
  ) {
    return {
      ok: true,
      status: "not_eligible",
      reason: `payment=${session.payment_status ?? "unknown"};subscription=${subscriptionStatus ?? "unknown"}`,
    };
  }

  const meta = session.metadata ?? {};
  const plan = meta.plan_tier ?? meta.htc_plan ?? meta.wevenu_plan ?? "unknown";
  const welcomeBack = readWelcomeBackFromMeta(meta);
  const onboardingType = parseOnboardingType(meta.onboarding_type);

  let foundingMember = readFoundingFromMeta(meta);
  const offerStore = isPricingLaunchV1Ready()
    ? requireDurablePricingOfferStore()
    : getPricingOfferStore();
  let checkoutOffer = await offerStore.getOfferBySessionId(session.id);
  if (!checkoutOffer && meta.checkout_offer_id) {
    checkoutOffer = await offerStore.getOfferById(meta.checkout_offer_id);
  }
  if (checkoutOffer) {
    foundingMember = shouldHonorIssuedFoundingOffer(checkoutOffer);
  }

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;

  const { email: customerEmail, venueName } = await resolveCustomerEmailAndVenue(
    stripe,
    customerId,
    session.customer_details?.email?.trim() ||
      session.customer_email?.trim() ||
      null,
    meta.venue_name?.trim() || "",
  );

  try {
    const record = await createVenueEnrollment({
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: customerId,
      stripeCheckoutSessionId: session.id,
      venueName,
      customerEmail,
      customerFirstName: meta.owner_first_name?.trim() || null,
      customerLastName: meta.owner_last_name?.trim() || null,
      plan,
      planName: meta.plan_name?.trim() || null,
      foundingMember,
      welcomeBackRequested: welcomeBack,
      onboardingType,
      paymentStatus: session.payment_status === "paid" ? "successful" : "pending",
      mrrCents: null,
    });
    return { ok: true, status: "reconciled", enrollmentId: record.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[stripe] reconcile paid checkout failed", {
      sessionId: trimmed,
      message,
    });
    return { ok: false, error: message };
  }
}
