import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { sendRelationshipEmail, sendReactivationEmail } from "@shared/email";
import {
  loadLiveStore,
  markDunningReminderSent,
  reactivateRelationshipAccount,
  recordPaymentFailed,
  type DunningDay,
} from "@shared/relationships";
import { createVenueEnrollment } from "@/lib/crm/service";
import {
  isAutomaticFoundingMember,
  parseOnboardingType,
  parseWelcomeBackRequested,
} from "@/lib/marketing/enrollment";
import { syncSubscriptionLifecycleToRelationship } from "@/lib/relationships/bridge";
import { getMarketingSiteUrl, getStripe } from "@/lib/stripe/config";
import {
  estimateMrrCentsFromPlan,
  mrrCentsFromStripeSubscription,
} from "@/lib/stripe/mrr";

export const runtime = "nodejs";

/**
 * Stripe webhook for Hello to Cheers SaaS subscription lifecycle.
 *
 * checkout.session.completed → enrollment + Relationship + emails + product sync
 *   (WG defers product sync)
 * customer.subscription.* → lifecycle status / MRR
 * invoice.payment_failed → dunning schedule (0/3/7/14/21)
 * invoice.paid → clear dunning / reactivate when recovering from past_due
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
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      await handleInvoicePaid(stripe, invoice);
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      await handleInvoicePaymentFailed(stripe, invoice);
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

async function createBillingPortalUrl(
  stripe: Stripe,
  customerId: string | null,
): Promise<string | null> {
  if (!customerId) return null;
  try {
    const siteUrl = getMarketingSiteUrl();
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${siteUrl}/pricing`,
    });
    return portal.url;
  } catch (error) {
    console.warn("[stripe] billing portal create failed", error);
    return null;
  }
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
      relationshipId: meta.relationship_id || null,
      legalAccepted: meta.legal_accepted === "true",
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

  let mrrSource: Stripe.Subscription = subscription;
  if (mrrCentsFromStripeSubscription(subscription) <= 0 && !deleted) {
    const loaded = await loadSubscriptionForMrr(stripe, subscription.id);
    if (loaded) mrrSource = loaded;
  }

  const mrrCents = resolveMrrCents(mrrSource, plan ?? "");

  await syncSubscriptionLifecycleToRelationship({
    email,
    venueName: meta.venue_name?.trim() || venueName,
    plan,
    planName: meta.plan_name?.trim() || null,
    foundingMember:
      meta.founding_member != null ? readFoundingFromMeta(meta) : undefined,
    welcomeBackRequested:
      meta.welcome_back != null || meta.welcome_back_requested != null
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

  if (
    !deleted &&
    (subscription.status === "past_due" || subscription.status === "unpaid")
  ) {
    await handleDunningForCustomer(stripe, {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      email,
    });
  }

  if (!deleted && subscription.status === "active") {
    await maybeReactivateFromPayment({
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      email,
    });
  }

  console.info(`[stripe] subscription lifecycle synced`, {
    id: subscription.id,
    status: subscription.status,
    deleted,
    created: _created,
    mrrCents,
    plan,
  });
}

function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const legacy = invoice as Stripe.Invoice & {
    subscription?: string | { id?: string } | null;
  };
  if (typeof legacy.subscription === "string") return legacy.subscription;
  if (legacy.subscription && typeof legacy.subscription === "object") {
    return legacy.subscription.id ?? null;
  }
  const parent = (
    invoice as Stripe.Invoice & {
      parent?: {
        subscription_details?: { subscription?: string | { id?: string } | null };
      } | null;
    }
  ).parent?.subscription_details?.subscription;
  if (typeof parent === "string") return parent;
  if (parent && typeof parent === "object") return parent.id ?? null;
  return null;
}

async function handleInvoicePaymentFailed(
  stripe: Stripe,
  invoice: Stripe.Invoice,
): Promise<void> {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id ?? null;
  const subscriptionId = subscriptionIdFromInvoice(invoice);

  const { email } = await resolveCustomerEmailAndVenue(
    stripe,
    customerId,
    invoice.customer_email?.trim() || null,
    "",
  );

  console.info("[stripe] invoice.payment_failed", {
    id: invoice.id,
    customer: customerId,
    subscription: subscriptionId,
  });

  await handleDunningForCustomer(stripe, {
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    email,
    invoiceId: invoice.id,
  });
}

async function handleDunningForCustomer(
  stripe: Stripe,
  input: {
    stripeCustomerId: string | null;
    stripeSubscriptionId?: string | null;
    email?: string | null;
    invoiceId?: string;
  },
): Promise<void> {
  const result = await recordPaymentFailed({
    stripeCustomerId: input.stripeCustomerId,
    stripeSubscriptionId: input.stripeSubscriptionId,
    email: input.email,
    invoiceId: input.invoiceId,
  });

  if (!result.relationship || result.reminderDay == null) return;

  const portalUrl = await createBillingPortalUrl(
    stripe,
    result.relationship.stripeCustomerId || input.stripeCustomerId,
  );
  const to = result.relationship.owner.email?.trim();
  if (!to) return;

  const day = result.reminderDay as DunningDay;
  const templateId =
    day === 21 || result.shouldSuspend ? "account_suspended" : "payment_reminder";

  try {
    await sendRelationshipEmail({
      relationshipId: result.relationship.id,
      to,
      templateId,
      vars: {
        firstName: result.relationship.owner.firstName,
        venueName: result.relationship.venue.name,
        planName: result.relationship.planName,
        dunningDay: day,
        billingPortalUrl: portalUrl,
      },
      meta: { trigger: "invoice.payment_failed", dunning_day: day },
    });
    await markDunningReminderSent(result.relationship.id, day);
  } catch (error) {
    console.error("[stripe] dunning email failed", error);
  }
}

async function handleInvoicePaid(
  stripe: Stripe,
  invoice: Stripe.Invoice,
): Promise<void> {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id ?? null;
  const subscriptionId = subscriptionIdFromInvoice(invoice);

  const { email } = await resolveCustomerEmailAndVenue(
    stripe,
    customerId,
    invoice.customer_email?.trim() || null,
    "",
  );

  console.info("[stripe] invoice.paid", {
    id: invoice.id,
    customer: customerId,
    amount_paid: invoice.amount_paid,
  });

  await maybeReactivateFromPayment({
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    email,
  });
}

async function maybeReactivateFromPayment(input: {
  stripeCustomerId: string | null;
  stripeSubscriptionId?: string | null;
  email?: string | null;
}): Promise<void> {
  const store = await loadLiveStore();
  const relationship =
    (input.stripeSubscriptionId
      ? store.relationships.find(
          (r) => r.stripeSubscriptionId === input.stripeSubscriptionId,
        )
      : undefined) ||
    (input.stripeCustomerId
      ? store.relationships.find(
          (r) => r.stripeCustomerId === input.stripeCustomerId,
        )
      : undefined) ||
    (input.email
      ? store.relationships.find(
          (r) =>
            (r.owner.email || "").trim().toLowerCase() ===
            input.email!.trim().toLowerCase(),
        )
      : undefined);

  if (!relationship) return;
  const needsReactivate =
    relationship.status === "suspended" ||
    relationship.status === "at_risk" ||
    relationship.accessDisabled ||
    (relationship.dunning && !relationship.dunning.clearedAt);

  if (!needsReactivate) return;

  const updated = await reactivateRelationshipAccount({
    relationshipId: relationship.id,
    fromPaymentSuccess: true,
  });
  if (!updated?.owner.email) return;

  try {
    await sendReactivationEmail({
      relationshipId: updated.id,
      customerEmail: updated.owner.email,
      venueName: updated.venue.name,
      firstName: updated.owner.firstName,
    });
  } catch (error) {
    console.error("[stripe] reactivation email failed", error);
  }
}
