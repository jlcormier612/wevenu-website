import { mapPlanId, planDisplayName } from "./normalize";
import {
  mutateRelationship,
  personFromFields,
  type FindOrCreateResult,
} from "./service";
import { loadLiveStore } from "./store";
import type { OnboardingType, PlanId, SubscriptionStatus } from "./types";
import { ensureWhiteGloveChecklist } from "./white-glove-checklist";

async function maybeEnsureWhiteGloveChecklist(
  result: FindOrCreateResult | null | undefined,
): Promise<void> {
  if (!result?.relationship || result.relationship.onboardingType !== "white_glove") {
    return;
  }
  await ensureWhiteGloveChecklist(result.relationship.id);
}

function safeBody(parts: Array<string | null | undefined>): string {
  return parts.filter((p) => (p ?? "").trim().length > 0).join("\n\n");
}

/** Website Contact Us form */
export async function ingestContactForm(input: {
  name?: string;
  email: string;
  venueName?: string;
  message?: string;
  sourceId?: string;
}): Promise<FindOrCreateResult> {
  const person = personFromFields({ name: input.name });
  return (await mutateRelationship({
    find: {
      email: input.email,
      venueName: input.venueName,
      firstName: person.firstName,
      lastName: person.lastName,
      referralSource: "Website Contact Us",
    },
    patch: {
      status: "inquiry",
    },
    event: {
      type: "contact_form",
      title: "Contact form submitted",
      body: input.message?.trim() || undefined,
      occurredAt: new Date().toISOString(),
      meta: { sourceId: input.sourceId ?? null },
    },
    communication: {
      channel: "contact_form",
      subject: "Contact Us",
      body: safeBody([
        input.message,
        input.venueName ? `Venue: ${input.venueName}` : null,
      ]),
      direction: "inbound",
      occurredAt: new Date().toISOString(),
      authorName: [person.firstName, person.lastName].filter(Boolean).join(" ") || input.email,
    },
    notification: {
      type: "new_inquiry",
      title: "New contact inquiry",
      body: `${input.venueName?.trim() || person.firstName || input.email} reached out via Contact Us.`,
    },
  }))!;
}

/** Schedule a Walkthrough form (or Calendly invitee.created with real scheduledAt). */
export async function ingestWalkthroughRequest(input: {
  name?: string;
  email: string;
  venueName?: string;
  message?: string;
  scheduledAt?: string | null;
  sourceId?: string;
  referralSource?: string;
  assignedTeamMemberId?: string;
}): Promise<FindOrCreateResult> {
  const person = personFromFields({ name: input.name });
  const hasDate = Boolean(input.scheduledAt?.trim());
  const scheduledAt = hasDate
    ? new Date(input.scheduledAt!).toISOString()
    : new Date(Date.now() + 7 * 86_400_000).toISOString();
  const whenLabel = hasDate
    ? new Date(scheduledAt).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (await mutateRelationship({
    find: {
      email: input.email,
      venueName: input.venueName,
      firstName: person.firstName,
      lastName: person.lastName,
      referralSource: input.referralSource ?? "Website Walkthrough",
      assignedTeamMemberId: input.assignedTeamMemberId,
    },
    patch: {
      status: hasDate ? "walkthrough_scheduled" : "walkthrough_requested",
      nextMilestone: hasDate ? "Upcoming walkthrough" : "Qualify & schedule walkthrough",
      nextMilestoneAt: hasDate ? scheduledAt : undefined,
      assignedTeamMemberId: input.assignedTeamMemberId,
    },
    event: {
      type: hasDate ? "walkthrough_scheduled" : "walkthrough_requested",
      title: hasDate ? "Walkthrough scheduled" : "Walkthrough requested",
      body:
        safeBody([
          input.message,
          whenLabel ? `Scheduled for ${whenLabel}` : null,
        ]) || undefined,
      occurredAt: new Date().toISOString(),
      meta: {
        sourceId: input.sourceId ?? null,
        scheduledAt: hasDate ? scheduledAt : null,
      },
    },
    communication: {
      channel: "walkthrough_request",
      subject: hasDate ? "Walkthrough scheduled" : "Walkthrough request",
      body: safeBody([
        input.message,
        input.venueName ? `Venue: ${input.venueName}` : null,
        hasDate ? `Scheduled: ${scheduledAt}` : null,
      ]),
      direction: "inbound",
      occurredAt: new Date().toISOString(),
      authorName: [person.firstName, person.lastName].filter(Boolean).join(" ") || input.email,
    },
    walkthrough: {
      scheduledAt,
      assignedTeamMemberId: input.assignedTeamMemberId || "tm_sara",
      status: "upcoming",
      notes: input.message?.trim() || undefined,
      location: input.venueName?.trim() || undefined,
    },
    notification: {
      type: "walkthrough_scheduled",
      title: hasDate ? "Walkthrough scheduled" : "Walkthrough requested",
      body: hasDate
        ? `${input.venueName?.trim() || person.firstName || input.email} booked a walkthrough for ${whenLabel}.`
        : `${input.venueName?.trim() || person.firstName || input.email} requested a walkthrough.`,
    },
  }))!;
}

/** Calendly invitee.canceled — mark upcoming walkthrough cancelled + timeline. */
export async function ingestWalkthroughCanceled(input: {
  email: string;
  name?: string;
  venueName?: string;
  scheduledAt?: string | null;
  reason?: string | null;
  sourceId?: string;
}): Promise<FindOrCreateResult | null> {
  const { setWalkthroughStatus } = await import("./service");
  const person = personFromFields({ name: input.name });
  const store = await loadLiveStore();
  const email = input.email.trim().toLowerCase();
  const existing = store.relationships.find(
    (r) => (r.owner.email || "").trim().toLowerCase() === email,
  );
  if (!existing) {
    // Do not create a Relationship on cancel alone.
    return null;
  }

  const targetStart = input.scheduledAt?.trim()
    ? new Date(input.scheduledAt).toISOString()
    : null;

  const upcoming = store.walkthroughs
    .filter((w) => w.relationshipId === existing.id && w.status === "upcoming")
    .sort(
      (a, b) =>
        new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
    );

  let match = targetStart
    ? upcoming.find((w) => w.scheduledAt === targetStart)
    : undefined;
  if (!match) match = upcoming[0];

  if (match) {
    await setWalkthroughStatus(match.id, "cancelled", {
      reason: input.reason,
      actorId: undefined,
      sourceId: input.sourceId,
    });
    return { relationship: existing, created: false };
  }

  // No walkthrough row — still append timeline on the Relationship.
  return (await mutateRelationship({
    find: {
      email: input.email,
      venueName: input.venueName || existing.venue.name,
      firstName: person.firstName,
      lastName: person.lastName,
    },
    updateOnly: true,
    event: {
      type: "walkthrough_cancelled",
      title: "Walkthrough cancelled",
      body: input.reason?.trim() || undefined,
      occurredAt: new Date().toISOString(),
      meta: {
        sourceId: input.sourceId ?? null,
        scheduledAt: targetStart,
      },
    },
  }));
}

/** Manual Add Relationship from the workspace. */
export async function ingestManualRelationship(input: {
  venueName: string;
  ownerName?: string;
  email: string;
  phone?: string;
  notes?: string;
  status?: "inquiry" | "walkthrough_requested" | "walkthrough_scheduled";
  actorId?: string;
}): Promise<FindOrCreateResult> {
  const person = personFromFields({ name: input.ownerName });
  const now = new Date().toISOString();
  return (await mutateRelationship({
    find: {
      email: input.email,
      venueName: input.venueName,
      firstName: person.firstName,
      lastName: person.lastName,
      phone: input.phone,
      referralSource: "Manual entry",
    },
    patch: {
      status: input.status ?? "inquiry",
      notes: input.notes,
      ownerPhone: input.phone,
    },
    event: {
      type: "inquiry_received",
      title: "Manually added",
      body: input.notes?.trim() || "Relationship created from the workspace.",
      occurredAt: now,
      actorId: input.actorId,
      meta: { source: "manual" },
    },
    notification: {
      type: "new_inquiry",
      title: "Relationship added",
      body: `${input.venueName.trim()} was added manually.`,
      createdAt: now,
    },
  }))!;
}

/** Optional draft when Get Started / Checkout Session is created */
export async function ingestCheckoutStarted(input: {
  email?: string | null;
  venueName?: string | null;
  plan?: string | null;
  planName?: string | null;
  welcomeBack?: boolean;
  onboardingType?: OnboardingType | "self_guided" | "white_glove";
  checkoutSessionId?: string | null;
}): Promise<FindOrCreateResult | null> {
  const email = input.email?.trim();
  const venueName = input.venueName?.trim();
  const checkoutSessionId = input.checkoutSessionId?.trim() || null;
  // Prefer email/venue; session id alone still opens a draft so purchase can merge.
  if (!email && !venueName && !checkoutSessionId) return null;

  const planId = mapPlanId(input.plan);
  const planName = planDisplayName(planId, input.planName);
  const draftVenue =
    venueName ||
    (email ? undefined : `Checkout ${checkoutSessionId?.slice(-8) || "draft"}`);

  return (await mutateRelationship({
    find: {
      email,
      venueName: draftVenue,
      referralSource: "Pricing checkout",
      stripeCheckoutSessionId: checkoutSessionId,
    },
    patch: {
      status: "inquiry",
      planId: planId === "none" ? undefined : planId,
      planName: planId === "none" ? undefined : planName,
      welcomeBackRequested: input.welcomeBack ? true : undefined,
      welcomeBackVerified: input.welcomeBack ? "pending" : undefined,
      onboardingType:
        input.onboardingType === "white_glove" || input.onboardingType === "self_guided"
          ? input.onboardingType
          : undefined,
      stripeCheckoutSessionId: checkoutSessionId,
    },
    event: {
      type: "checkout_started",
      title: "Checkout started",
      body: [
        planName !== "—" ? `Interested in ${planName}` : null,
        input.welcomeBack ? "Welcome Back noted" : null,
        input.onboardingType === "white_glove" ? "White Glove selected" : null,
      ]
        .filter(Boolean)
        .join(" · ") || undefined,
      occurredAt: new Date().toISOString(),
      meta: {
        plan: input.plan ?? null,
        welcome_back: input.welcomeBack ?? false,
        onboarding_type: input.onboardingType ?? null,
        checkout_session_id: checkoutSessionId,
      },
    },
  }))!;
}

/** Stripe checkout.session.completed → subscribed / onboarding */
export async function ingestSubscriptionPurchased(input: {
  email?: string | null;
  venueName?: string | null;
  plan?: string | null;
  planName?: string | null;
  foundingMember: boolean;
  welcomeBackRequested: boolean;
  onboardingType: "self_guided" | "white_glove";
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
  stripeCheckoutSessionId?: string | null;
  mrrCents?: number;
  subscriptionStatus?: "trialing" | "active" | "past_due" | "cancelled" | "paused";
}): Promise<FindOrCreateResult> {
  const planId: PlanId = mapPlanId(input.plan);
  const planName = planDisplayName(planId, input.planName);
  const isWhiteGlove = input.onboardingType === "white_glove";
  const status = isWhiteGlove ? "onboarding" : "subscribed";
  const now = new Date().toISOString();
  const resolvedPlanId = planId === "none" ? "gather" : planId;

  const extraEvents: Array<{
    type:
      | "welcome_back_requested"
      | "white_glove_purchased"
      | "founder_status_assigned";
    title: string;
    body?: string;
    occurredAt: string;
  }> = [];

  if (input.welcomeBackRequested) {
    extraEvents.push({
      type: "welcome_back_requested",
      title: "Welcome Back requested",
      body: "Self-identified at checkout. Verification pending.",
      occurredAt: now,
    });
  }
  if (isWhiteGlove) {
    extraEvents.push({
      type: "white_glove_purchased",
      title: "White Glove Selected",
      body: "White Glove Setup purchased with subscription.",
      occurredAt: now,
    });
  }
  if (input.foundingMember) {
    extraEvents.push({
      type: "founder_status_assigned",
      title: "Founding Member assigned",
      body: "Automatic while Founder Program is active.",
      occurredAt: now,
    });
  }

  const purchaseTitle = input.foundingMember
    ? `Founder Subscription Purchased — ${planName}`
    : `Subscription Purchased — ${planName}`;

  const result = (await mutateRelationship({
    find: {
      email: input.email,
      venueName: input.venueName,
      referralSource: "Stripe checkout",
      stripeCustomerId: input.stripeCustomerId,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId,
    },
    patch: {
      status,
      planId: resolvedPlanId,
      planName,
      // Ratchet true-only inside applyFieldPatch; omit false so we never clear.
      foundingMember: input.foundingMember ? true : undefined,
      welcomeBackRequested: input.welcomeBackRequested ? true : undefined,
      welcomeBackVerified: input.welcomeBackRequested ? "pending" : undefined,
      onboardingType: input.onboardingType,
      currentStageLabel: isWhiteGlove ? "White Glove Onboarding" : "Subscribed",
      nextMilestone: isWhiteGlove ? "Kickoff Call" : "Self-guided setup",
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId,
      ownerEmail: input.email,
      venueName: input.venueName,
    },
    event: {
      type: "subscription_purchased",
      title: purchaseTitle,
      body: [
        input.foundingMember ? "Founding Member" : null,
        input.welcomeBackRequested ? "Welcome Back requested" : null,
        isWhiteGlove ? "White Glove onboarding" : "Self-guided onboarding",
      ]
        .filter(Boolean)
        .join(" · "),
      occurredAt: now,
      meta: {
        plan: input.plan ?? null,
        founding_member: input.foundingMember,
        welcome_back: input.welcomeBackRequested,
        onboarding_type: input.onboardingType,
        stripe_subscription_id: input.stripeSubscriptionId ?? null,
        stripe_customer_id: input.stripeCustomerId ?? null,
        stripe_checkout_session_id: input.stripeCheckoutSessionId ?? null,
        subscription_status: input.subscriptionStatus ?? "active",
        mrr_cents: input.mrrCents ?? 0,
      },
    },
    extraEvents,
    subscription: {
      planId: resolvedPlanId,
      planName,
      status: input.subscriptionStatus ?? "active",
      mrrCents: input.mrrCents ?? 0,
      startedAt: now,
      foundingMember: input.foundingMember,
      stripeSubscriptionId: input.stripeSubscriptionId,
      stripeCustomerId: input.stripeCustomerId,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId,
    },
    notification: {
      type: isWhiteGlove
        ? "white_glove_purchased"
        : input.welcomeBackRequested
          ? "welcome_back_requested"
          : "subscription_purchased",
      title: isWhiteGlove
        ? "White Glove purchased"
        : input.welcomeBackRequested
          ? "Welcome Back pending"
          : input.foundingMember
            ? "Founder subscription"
            : "New subscription",
      body: `${input.venueName?.trim() || input.email || "A venue"} subscribed to ${planName}.`,
      createdAt: now,
    },
  }))!;

  await maybeEnsureWhiteGloveChecklist(result);
  return result;
}

function mapStripeStatusToLocal(
  status: string | null | undefined,
): SubscriptionStatus {
  switch ((status ?? "").toLowerCase()) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "paused":
      return "paused";
    case "canceled":
    case "cancelled":
    case "incomplete_expired":
      return "cancelled";
    default:
      return "active";
  }
}

/**
 * Stripe customer.subscription.updated / deleted (and created as a soft sync).
 * Updates subscription status + MRR on the existing Relationship — never duplicates.
 * Timeline only when status actually changes (or cancel/delete).
 */
export async function ingestSubscriptionLifecycle(input: {
  email?: string | null;
  venueName?: string | null;
  plan?: string | null;
  planName?: string | null;
  foundingMember?: boolean;
  welcomeBackRequested?: boolean;
  onboardingType?: "self_guided" | "white_glove" | null;
  stripeSubscriptionId: string;
  stripeCustomerId?: string | null;
  stripeCheckoutSessionId?: string | null;
  mrrCents?: number;
  /** Stripe subscription.status string */
  stripeStatus: string;
  /** True for customer.subscription.deleted */
  deleted?: boolean;
  /** When false, skip creating a new Relationship if none exists (default true if email present). */
  allowCreate?: boolean;
}): Promise<FindOrCreateResult | null> {
  const stripeSubscriptionId = input.stripeSubscriptionId.trim();
  if (!stripeSubscriptionId) return null;

  const nextStatus = input.deleted
    ? ("cancelled" as const)
    : mapStripeStatusToLocal(input.stripeStatus);
  const isCancelled = nextStatus === "cancelled" || Boolean(input.deleted);
  const now = new Date().toISOString();

  const store = await loadLiveStore();
  const existingSub = store.subscriptions.find(
    (s) => s.stripeSubscriptionId === stripeSubscriptionId,
  );
  const existingRel =
    store.relationships.find(
      (r) => r.stripeSubscriptionId?.trim() === stripeSubscriptionId,
    ) ||
    (input.stripeCustomerId
      ? store.relationships.find(
          (r) => r.stripeCustomerId?.trim() === input.stripeCustomerId?.trim(),
        )
      : undefined) ||
    (input.email
      ? store.relationships.find(
          (r) =>
            (r.owner.email || "").trim().toLowerCase() ===
            input.email!.trim().toLowerCase(),
        )
      : undefined) ||
    (existingSub
      ? store.relationships.find((r) => r.id === existingSub.relationshipId)
      : undefined);

  const previousStatus = existingSub?.status;
  const statusChanged = !previousStatus || previousStatus !== nextStatus;

  const planId = mapPlanId(input.plan);
  const planName =
    planId !== "none"
      ? planDisplayName(planId, input.planName)
      : input.planName?.trim() || existingRel?.planName || "—";
  const resolvedPlanId =
    planId !== "none" ? planId : existingRel?.planId ?? "none";

  const allowCreate =
    input.allowCreate ?? Boolean(input.email?.trim() || input.venueName?.trim());

  if (!existingRel && !allowCreate) {
    return null;
  }

  let event:
    | {
        type: "subscription_updated" | "subscription_cancelled";
        title: string;
        body?: string;
        occurredAt: string;
        meta?: Record<string, string | number | boolean | null>;
      }
    | undefined;

  if (statusChanged || isCancelled) {
    if (isCancelled) {
      event = {
        type: "subscription_cancelled",
        title: "Subscription cancelled",
        body: previousStatus
          ? `Status changed from ${previousStatus} to cancelled.`
          : "Subscription cancelled in Stripe.",
        occurredAt: now,
        meta: {
          previous_status: previousStatus ?? null,
          subscription_status: "cancelled",
          stripe_subscription_id: stripeSubscriptionId,
          stripe_customer_id: input.stripeCustomerId ?? null,
          mrr_cents: input.mrrCents ?? existingSub?.mrrCents ?? 0,
        },
      };
    } else {
      event = {
        type: "subscription_updated",
        title: `Subscription ${nextStatus.replace("_", " ")}`,
        body: previousStatus
          ? `Status changed from ${previousStatus} to ${nextStatus}.`
          : `Subscription is ${nextStatus}.`,
        occurredAt: now,
        meta: {
          previous_status: previousStatus ?? null,
          subscription_status: nextStatus,
          stripe_subscription_id: stripeSubscriptionId,
          stripe_customer_id: input.stripeCustomerId ?? null,
          mrr_cents: input.mrrCents ?? existingSub?.mrrCents ?? 0,
          plan: input.plan ?? null,
        },
      };
    }
  }

  const result = await mutateRelationship({
    find: {
      email: input.email,
      venueName: input.venueName || existingRel?.venue.name,
      referralSource: "Stripe subscription",
      stripeCustomerId: input.stripeCustomerId,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId,
      stripeSubscriptionId,
    },
    updateOnly: !allowCreate,
    forceStatus: isCancelled ? "former_customer" : undefined,
    patch: {
      planId: resolvedPlanId === "none" ? undefined : resolvedPlanId,
      planName: planName !== "—" ? planName : undefined,
      foundingMember: input.foundingMember ? true : undefined,
      welcomeBackRequested: input.welcomeBackRequested ? true : undefined,
      onboardingType:
        input.onboardingType === "white_glove" || input.onboardingType === "self_guided"
          ? input.onboardingType
          : undefined,
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId,
      currentStageLabel: isCancelled ? "Former Customer" : undefined,
      ownerEmail: input.email,
      venueName: input.venueName,
    },
    event,
    subscription: {
      planId: resolvedPlanId === "none" ? existingRel?.planId ?? "gather" : resolvedPlanId,
      planName,
      status: nextStatus,
      mrrCents:
        typeof input.mrrCents === "number"
          ? input.mrrCents
          : (existingSub?.mrrCents ?? 0),
      startedAt: existingSub?.startedAt ?? now,
      ...(isCancelled ? { cancelledAt: now } : {}),
      foundingMember:
        input.foundingMember === true
          ? true
          : (existingSub?.foundingMember ?? existingRel?.foundingMember ?? false),
      stripeSubscriptionId,
      stripeCustomerId: input.stripeCustomerId,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId,
    },
  });

  await maybeEnsureWhiteGloveChecklist(result);
  return result;
}

/** Standalone Welcome Back request form (not checkout). */
export async function ingestWelcomeBackRequest(input: {
  businessName?: string;
  venueName?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  notes?: string;
  yearsWithWeven?: string;
  sourceId?: string;
}): Promise<FindOrCreateResult> {
  const yearsNote = input.yearsWithWeven?.trim()
    ? `Years with Weven: ${input.yearsWithWeven.trim()}`
    : null;

  return (await mutateRelationship({
    find: {
      email: input.email,
      venueName: input.venueName || input.businessName,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      referralSource: "Welcome Back form",
    },
    patch: {
      status: "inquiry",
      welcomeBackRequested: true,
      welcomeBackVerified: "pending",
    },
    event: {
      type: "welcome_back_requested",
      title: "Welcome Back requested",
      body: safeBody([input.notes, yearsNote]) || undefined,
      occurredAt: new Date().toISOString(),
      meta: { sourceId: input.sourceId ?? null },
    },
    communication: {
      channel: "contact_form",
      subject: "Welcome Back Request",
      body: safeBody([
        input.notes,
        yearsNote,
        input.businessName ? `Business: ${input.businessName}` : null,
        input.phone ? `Phone: ${input.phone}` : null,
      ]),
      direction: "inbound",
      occurredAt: new Date().toISOString(),
      authorName:
        [input.firstName, input.lastName].filter(Boolean).join(" ") || input.email,
    },
    notification: {
      type: "welcome_back_requested",
      title: "Welcome Back request",
      body: `${input.venueName || input.businessName || input.email} submitted a Welcome Back request.`,
    },
  }))!;
}

/** Newsletter signup */
export async function ingestNewsletterSignup(input: {
  email: string;
  name?: string;
  venueName?: string;
  sourceId?: string;
}): Promise<FindOrCreateResult> {
  const person = personFromFields({ name: input.name });
  return (await mutateRelationship({
    find: {
      email: input.email,
      venueName: input.venueName,
      firstName: person.firstName,
      lastName: person.lastName,
      referralSource: "Newsletter",
    },
    patch: {
      status: "inquiry",
    },
    event: {
      type: "newsletter_signup",
      title: "Newsletter signup",
      occurredAt: new Date().toISOString(),
      meta: { sourceId: input.sourceId ?? null },
    },
    communication: {
      channel: "newsletter",
      subject: "Newsletter signup",
      body: `${input.email} subscribed to updates.`,
      direction: "inbound",
      occurredAt: new Date().toISOString(),
      authorName: person.firstName || input.email,
    },
    notification: {
      type: "newsletter_signup",
      title: "Newsletter signup",
      body: input.email,
    },
  }))!;
}

/** Support contact form — status → Support only if already a customer (promoteStatus). */
export async function ingestSupportRequest(input: {
  name?: string;
  email: string;
  venueName?: string;
  message?: string;
  sourceId?: string;
}): Promise<FindOrCreateResult> {
  const person = personFromFields({ name: input.name });
  return (await mutateRelationship({
    find: {
      email: input.email,
      venueName: input.venueName,
      firstName: person.firstName,
      lastName: person.lastName,
      referralSource: "Support form",
    },
    patch: {
      status: "support",
    },
    bumpSupportOpenCount: true,
    event: {
      type: "support_request",
      title: "Support request",
      body: input.message?.trim() || undefined,
      occurredAt: new Date().toISOString(),
      meta: { sourceId: input.sourceId ?? null },
    },
    communication: {
      channel: "support",
      subject: "Support request",
      body: safeBody([
        input.message,
        input.venueName ? `Venue: ${input.venueName}` : null,
      ]),
      direction: "inbound",
      occurredAt: new Date().toISOString(),
      authorName: [person.firstName, person.lastName].filter(Boolean).join(" ") || input.email,
    },
    notification: {
      type: "support_request_submitted",
      title: "Support request",
      body: `${input.venueName?.trim() || person.firstName || input.email} submitted a support request.`,
    },
  }))!;
}
