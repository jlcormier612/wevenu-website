import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { createVenueEnrollment } from "@/lib/crm/service";
import {
  isAutomaticFoundingMember,
  parseOnboardingType,
  parseWelcomeBackRequested,
} from "@/lib/marketing/enrollment";
import { syncSubscriptionLifecycleToRelationship } from "@/lib/relationships/bridge";
import { getStripe } from "@/lib/stripe/config";
import {
  estimateMrrCentsFromPlan,
  mrrCentsFromStripeSubscription,
} from "@/lib/stripe/mrr";

export const runtime = "nodejs";

/**
 * Stripe webhook for Hello to Cheers SaaS subscription lifecycle.
 * Configure this endpoint in the Stripe Dashboard (platform account).
 *
 * On checkout.session.completed:
 * - Creates a CRM venue enrollment record
 * - Upserts the shared Relationship (findOrCreate by email / Stripe ids / venue)
 * - Appends timeline: Subscription Purchased (Founder title when applicable),
 *   Welcome Back requested, White Glove Selected, Founding Member assigned
 * - Stores plan, founding, welcome back, onboarding, customer/subscription/session ids
 * - Persists real MRR from Stripe subscription price objects when available
 *
 * On customer.subscription.updated / deleted (and created as soft sync):
 * - Updates Relationship subscription status + MRR
 * - Appends timeline when status changes (never duplicates Relationship)
 *
 * Never auto-verifies Welcome Back. Product welcome emails (Project 3) are sent
 * after Relationship upsert via sendEnrollmentProductEmails — timeline gets email_sent.
 * Product Sync (Project 10) runs after enrollment via enqueueProductSync.
 * Team CRM notify remains ops-only and is not timeline'd.
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
      await handleCheckoutCompleted(stripe, session);
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionLifecycle(
        stripe,
        subscription,
        event.type === "customer.subscription.deleted",
        event.type === "customer.subscription.created",
      );
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
  return isAutomaticFoundingMember();
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
        if (!customerEmail && customer.email) {
          customerEmail = customer.email;
        }
        if (!venueName) {
          const fromName = customer.name?.trim();
          const fromMeta = customer.metadata?.venue_name?.trim();
          venueName = fromMeta || fromName || "";
        }
      }
    } catch (error) {
      console.warn("[stripe] unable to load customer", error);
    }
  }

  if (!venueName) {
    venueName = customerEmail
      ? customerEmail.split("@")[0] || "Unknown venue"
      : "Unknown venue";
  }

  return { email: customerEmail, venueName };
}

async function loadSubscriptionForMrr(
  stripe: Stripe,
  subscriptionId: string | null,
): Promise<Stripe.Subscription | null> {
  if (!subscriptionId) return null;
  try {
    return await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["items.data.price"],
    });
  } catch (error) {
    console.warn("[stripe] unable to load subscription for MRR", error);
    return null;
  }
}

function resolveMrrCents(
  subscription: Stripe.Subscription | null,
  plan: string,
): number {
  if (subscription) {
    const fromStripe = mrrCentsFromStripeSubscription(subscription);
    if (fromStripe > 0) return fromStripe;
  }
  return estimateMrrCentsFromPlan(plan);
}

async function handleCheckoutCompleted(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const meta = session.metadata ?? {};
  const plan = meta.plan_tier ?? meta.wevenu_plan ?? "unknown";
  const welcomeBack = readWelcomeBackFromMeta(meta);
  const onboardingType = parseOnboardingType(meta.onboarding_type);
  const foundingMember = readFoundingFromMeta(meta);

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

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;

  const subscription = await loadSubscriptionForMrr(stripe, subscriptionId);
  const mrrCents = resolveMrrCents(subscription, plan);

  try {
    const record = await createVenueEnrollment({
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: customerId,
      stripeCheckoutSessionId: session.id,
      venueName,
      customerEmail,
      plan,
      planName: meta.plan_name?.trim() || null,
      foundingMember,
      welcomeBackRequested: welcomeBack,
      onboardingType,
      paymentStatus: session.payment_status === "paid" ? "successful" : "pending",
      mrrCents,
    });

    console.info("[stripe] checkout.session.completed → venue enrollment", {
      enrollmentId: record.id,
      plan: record.plan,
      foundingMember: record.foundingMember,
      welcomeBack: record.welcomeBackRequested,
      welcomeBackVerified: record.welcomeBackVerified,
      onboardingType: record.onboardingType,
      mrrCents: record.mrrCents,
    });
  } catch (error) {
    console.error("[stripe] failed to create venue enrollment", error);
  }
}

async function handleSubscriptionLifecycle(
  stripe: Stripe,
  subscription: Stripe.Subscription,
  deleted: boolean,
  _created: boolean,
): Promise<void> {
  const meta = subscription.metadata ?? {};
  const plan = meta.plan_tier ?? meta.wevenu_plan ?? null;
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? null;

  const { email, venueName } = await resolveCustomerEmailAndVenue(
    stripe,
    customerId,
    null,
    meta.venue_name?.trim() || "",
  );

  // Prefer expanded items on the event object; re-fetch if MRR would be 0.
  let mrrSource: Stripe.Subscription = subscription;
  if (mrrCentsFromStripeSubscription(subscription) <= 0 && !deleted) {
    const loaded = await loadSubscriptionForMrr(stripe, subscription.id);
    if (loaded) mrrSource = loaded;
  }

  const mrrCents = resolveMrrCents(mrrSource, plan ?? "");

  // created: soft sync only — purchase timeline comes from checkout.session.completed.
  // Do not create a brand-new Relationship from subscription.created alone unless
  // checkout was missed and we have an email (allowCreate when email present).
  await syncSubscriptionLifecycleToRelationship({
    email,
    venueName: meta.venue_name?.trim() || venueName,
    plan,
    planName: meta.plan_name?.trim() || null,
    foundingMember: meta.founding_member != null ? readFoundingFromMeta(meta) : undefined,
    welcomeBackRequested: meta.welcome_back != null || meta.welcome_back_requested != null
      ? readWelcomeBackFromMeta(meta)
      : undefined,
    onboardingType: meta.onboarding_type
      ? parseOnboardingType(meta.onboarding_type)
      : null,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: customerId,
    mrrCents,
    stripeStatus: subscription.status,
    deleted,
    allowCreate: Boolean(email),
  });

  console.info(`[stripe] subscription lifecycle synced`, {
    id: subscription.id,
    status: subscription.status,
    deleted,
    created: _created,
    mrrCents,
    plan,
  });
}
