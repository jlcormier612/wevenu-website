import { mapPlanId, planDisplayName } from "./normalize";
import {
  salesStageFromLifecycleStatus,
} from "./sales-cs";
import {
  mutateRelationship,
  personFromFields,
  type FindOrCreateResult,
} from "./service";
import { loadLiveStore, withLiveStore } from "./store";
import type {
  OnboardingType,
  PlanId,
  ProductFeedbackType,
  SubscriptionStatus,
  SupportInboxItem,
  SupportInboxSurface,
} from "./types";
import { ensureWhiteGloveChecklist } from "./white-glove-checklist";
import { randomUUID } from "crypto";

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
  firstName?: string;
  lastName?: string;
  email: string;
  venueName?: string;
  message?: string;
  sourceId?: string;
}): Promise<FindOrCreateResult> {
  const person = personFromFields({
    name: input.name,
    firstName: input.firstName,
    lastName: input.lastName,
  });
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
      salesStage: "inquiry",
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
  firstName?: string;
  lastName?: string;
  email: string;
  venueName?: string;
  message?: string;
  /** Only a real Calendly (or ops) start time promotes to walkthrough_scheduled. */
  scheduledAt?: string | null;
  sourceId?: string;
  referralSource?: string;
  assignedTeamMemberId?: string;
}): Promise<FindOrCreateResult> {
  const person = personFromFields({
    name: input.name,
    firstName: input.firstName,
    lastName: input.lastName,
  });
  const rawWhen = input.scheduledAt?.trim() || "";
  const parsedWhen = rawWhen ? new Date(rawWhen) : null;
  const hasDate = Boolean(parsedWhen && !Number.isNaN(parsedWhen.getTime()));
  // Placeholder row time when requested-but-unscheduled (status stays walkthrough_requested).
  const scheduledAt = hasDate
    ? parsedWhen!.toISOString()
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
      // Soft / email walkthrough request (no real datetime) stays Sales Inquiry.
      // Only Calendly / ops with a real scheduledAt → Walkthrough Scheduled.
      salesStage: hasDate ? "walkthrough_scheduled" : "inquiry",
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
  const status = input.status ?? "inquiry";
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
      status,
      salesStage: salesStageFromLifecycleStatus(status),
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
      salesStage: "inquiry",
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

/** Stripe checkout.session.completed → subscribed then onboarding path */
export async function ingestSubscriptionPurchased(input: {
  email?: string | null;
  venueName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
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
  /** Skip enterOnboardingAfterPurchase when caller handles it */
  deferOnboardingEntry?: boolean;
}): Promise<FindOrCreateResult> {
  const planId: PlanId = mapPlanId(input.plan);
  const planName = planDisplayName(planId, input.planName);
  const isWhiteGlove = input.onboardingType === "white_glove";
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
    forceStatus: "subscribed",
    patch: {
      planId: resolvedPlanId,
      planName,
      foundingMember: input.foundingMember ? true : undefined,
      welcomeBackRequested: input.welcomeBackRequested ? true : undefined,
      welcomeBackVerified: input.welcomeBackRequested ? "pending" : undefined,
      onboardingType: input.onboardingType,
      currentStageLabel: "Subscribed",
      nextMilestone: isWhiteGlove ? "Kickoff Call" : "Self-guided setup",
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId,
      paymentStatus: "paid",
      subscribedAt: now,
      salesStage: "closed_won",
      customerSuccessStage: isWhiteGlove ? "implementation" : "onboarding",
      ownerEmail: input.email,
      ownerFirstName: input.firstName,
      ownerLastName: input.lastName,
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

  if (!input.deferOnboardingEntry && result.relationship) {
    const { enterOnboardingAfterPurchase } = await import("./lifecycle");
    await enterOnboardingAfterPurchase({
      relationshipId: result.relationship.id,
      onboardingType: input.onboardingType,
    });
    const refreshed = await loadLiveStore();
    const updated = refreshed.relationships.find((r) => r.id === result.relationship.id);
    if (updated) result.relationship = updated;
  } else {
    await maybeEnsureWhiteGloveChecklist(result);
  }

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
  firstName?: string;
  lastName?: string;
  email: string;
  venueName?: string;
  message?: string;
  sourceId?: string;
}): Promise<FindOrCreateResult> {
  const person = personFromFields({
    name: input.name,
    firstName: input.firstName,
    lastName: input.lastName,
  });
  const subject = "Support request";
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
    openFeedbackItem: {
      type: "support",
      subject,
      body: input.message?.trim() || undefined,
      source: "marketing_support",
      productFeedbackId: input.sourceId,
    },
    event: {
      type: "support_request",
      title: "Support request",
      body: input.message?.trim() || undefined,
      occurredAt: new Date().toISOString(),
      meta: {
        sourceId: input.sourceId ?? null,
        feedback_type: "support",
      },
    },
    communication: {
      channel: "support",
      subject,
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
      href: null,
      meta: {
        panel: "support",
        feedback_type: "support",
        surface: "venue",
        venue_name: input.venueName?.trim() || undefined,
      },
    },
  }))!;
}

const PRODUCT_FEEDBACK_LABELS: Record<
  ProductFeedbackType,
  { title: string; subject: string; notificationTitle: string }
> = {
  support: {
    title: "Support request",
    subject: "Get Help",
    notificationTitle: "Support request",
  },
  bug: {
    title: "Bug report",
    subject: "Bug report",
    notificationTitle: "Bug report",
  },
  feature: {
    title: "Idea submitted",
    subject: "Idea",
    notificationTitle: "Product idea",
  },
  nps: {
    title: "NPS feedback",
    subject: "NPS feedback",
    notificationTitle: "NPS feedback",
  },
  general: {
    title: "Product feedback",
    subject: "Feedback",
    notificationTitle: "Product feedback",
  },
};

function normalizeProductFeedbackType(
  raw: string | undefined | null,
): ProductFeedbackType {
  switch ((raw || "").trim().toLowerCase()) {
    case "support":
    case "bug":
    case "feature":
    case "nps":
    case "general":
      return (raw || "").trim().toLowerCase() as ProductFeedbackType;
    default:
      return "general";
  }
}

/**
 * Product Get Help / feedback → Relationship CRM mirror.
 * Matches productSync.venueId → owner email → Stripe customer; findOrCreate by
 * email when needed (never invents a random Relationship without contact).
 */
export async function ingestProductFeedback(input: {
  productVenueId: string;
  email?: string | null;
  venueName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  stripeCustomerId?: string | null;
  feedbackType: string;
  subject?: string | null;
  body?: string | null;
  rating?: number | null;
  allowPublicShare?: boolean;
  productFeedbackId?: string | null;
  sourceUrl?: string | null;
  /** Bug-report screenshot URLs / paths when present. */
  attachments?: Array<{ url: string; path?: string; file_name?: string }> | null;
}): Promise<FindOrCreateResult | null> {
  const email = input.email?.trim() || null;
  const productVenueId = input.productVenueId.trim();
  if (!productVenueId && !email && !input.stripeCustomerId?.trim()) {
    console.warn(
      "[relationships] ingestProductFeedback soft-fail: no venue, email, or stripe id",
    );
    return null;
  }

  const feedbackType = normalizeProductFeedbackType(input.feedbackType);
  const labels = PRODUCT_FEEDBACK_LABELS[feedbackType];
  const subject =
    input.subject?.trim() ||
    (feedbackType === "nps" && input.rating != null
      ? `NPS ${input.rating}/10`
      : labels.subject);
  const now = new Date().toISOString();
  const person = personFromFields({
    firstName: input.firstName ?? undefined,
    lastName: input.lastName ?? undefined,
  });

  // Prefer match-only when we only have a venue id (no email to safely create).
  const updateOnly = !email;

  const store = await loadLiveStore();
  const byVenue = productVenueId
    ? store.relationships.find(
        (r) => r.productSync?.venueId?.trim() === productVenueId,
      )
    : undefined;
  const byEmail = email
    ? store.relationships.find(
        (r) =>
          (r.owner.email || "").trim().toLowerCase() === email.toLowerCase(),
      )
    : undefined;
  const byStripe = input.stripeCustomerId?.trim()
    ? store.relationships.find(
        (r) => r.stripeCustomerId?.trim() === input.stripeCustomerId!.trim(),
      )
    : undefined;
  const existing = byVenue || byEmail || byStripe;

  if (!existing && updateOnly) {
    console.warn(
      "[relationships] ingestProductFeedback soft-fail: no Relationship for venue",
      productVenueId,
    );
    return null;
  }

  const isHelpOrBug = feedbackType === "support" || feedbackType === "bug";
  const who =
    input.venueName?.trim() ||
    person.firstName ||
    email ||
    productVenueId;
  const attachmentUrls = (input.attachments ?? [])
    .map((a) => a?.url?.trim())
    .filter((u): u is string => Boolean(u));
  const attachmentLines =
    attachmentUrls.length > 0
      ? [
          `Screenshots (${attachmentUrls.length}):`,
          ...attachmentUrls.map((u, i) => `${i + 1}. ${u}`),
        ]
      : [];

  return (await mutateRelationship({
    find: {
      // Prefer existing contact keys so venueId-matched rows aren't duplicated.
      email: existing?.owner.email?.trim() || email,
      venueName: existing?.venue.name || input.venueName,
      firstName: person.firstName || existing?.owner.firstName,
      lastName: person.lastName || existing?.owner.lastName,
      referralSource: "Product feedback",
      stripeCustomerId: existing?.stripeCustomerId || input.stripeCustomerId,
    },
    updateOnly,
    productVenueId: productVenueId || undefined,
    // Overlay Support for all collected types so Today / CS queues stay unified.
    patch: {
      status: "support",
      // Fill owner email from product when CRM row was venue-linked without one.
      ownerEmail: email && !existing?.owner.email?.trim() ? email : undefined,
    },
    openFeedbackItem: {
      type: feedbackType,
      subject,
      body:
        safeBody([
          input.body,
          input.rating != null ? `Rating: ${input.rating}/10` : null,
          input.sourceUrl ? `URL: ${input.sourceUrl}` : null,
          ...attachmentLines,
        ]) || undefined,
      productFeedbackId: input.productFeedbackId ?? undefined,
      source: "product",
    },
    event: {
      type: feedbackType === "support" ? "support_request" : "feedback_received",
      title: labels.title,
      body:
        safeBody([
          input.body,
          input.rating != null ? `Rating: ${input.rating}/10` : null,
          input.sourceUrl ? `URL: ${input.sourceUrl}` : null,
          ...attachmentLines,
        ]) || undefined,
      occurredAt: now,
      meta: {
        feedback_type: feedbackType,
        product_feedback_id: input.productFeedbackId ?? null,
        product_venue_id: productVenueId || null,
        rating: input.rating ?? null,
        allow_public_share: input.allowPublicShare === true,
        source: "product",
        attachment_count: attachmentUrls.length,
        attachment_urls:
          attachmentUrls.length > 0 ? attachmentUrls.join("\n") : null,
      },
    },
    communication: {
      channel: "support",
      subject: labels.subject,
      body: safeBody([
        input.body,
        input.rating != null ? `Rating: ${input.rating}/10` : null,
        input.venueName ? `Venue: ${input.venueName}` : null,
        input.allowPublicShare === true ? "Public share consent: yes" : null,
        ...attachmentLines,
      ]),
      direction: "inbound",
      occurredAt: now,
      authorName:
        [person.firstName, person.lastName].filter(Boolean).join(" ") ||
        email ||
        "Product user",
    },
    notification: {
      type: isHelpOrBug ? "support_request_submitted" : "feedback_received",
      title: labels.notificationTitle,
      body: `${who} submitted ${labels.title.toLowerCase()} from product.`,
      href: null,
      meta: {
        panel: "support",
        feedback_type: feedbackType,
        surface: "venue",
        venue_name: input.venueName?.trim() || undefined,
      },
    },
  }))!;
}

/**
 * Vendor / client product feedback → CRM Support inbox.
 * Does NOT write Relationship.openFeedbackItems or bump supportOpenCount / health.
 */
export async function ingestProductPartnerFeedback(input: {
  surface: SupportInboxSurface;
  productVenueId?: string | null;
  vendorId?: string | null;
  clientId?: string | null;
  email?: string | null;
  actorName?: string | null;
  feedbackType: string;
  subject?: string | null;
  body?: string | null;
  rating?: number | null;
  allowPublicShare?: boolean;
  productFeedbackId?: string | null;
  sourceUrl?: string | null;
  /** Bug-report screenshot URLs / paths when present. */
  attachments?: Array<{ url: string; path?: string; file_name?: string }> | null;
}): Promise<SupportInboxItem | null> {
  const surface = input.surface === "client" ? "client" : "vendor";
  const feedbackType = normalizeProductFeedbackType(input.feedbackType);
  const labels = PRODUCT_FEEDBACK_LABELS[feedbackType];
  const subject =
    input.subject?.trim() ||
    (feedbackType === "nps" && input.rating != null
      ? `NPS ${input.rating}/10`
      : labels.subject);
  const now = new Date().toISOString();
  const productVenueId = input.productVenueId?.trim() || null;
  const attachmentUrls = (input.attachments ?? [])
    .map((a) => a?.url?.trim())
    .filter((u): u is string => Boolean(u));
  const attachmentLines =
    attachmentUrls.length > 0
      ? [
          `Screenshots (${attachmentUrls.length}):`,
          ...attachmentUrls.map((u, i) => `${i + 1}. ${u}`),
        ]
      : [];

  const { result } = await withLiveStore((store) => {
    if (!store.supportInboxItems) store.supportInboxItems = [];

    // Dedupe by product feedback id when present
    if (input.productFeedbackId) {
      const existing = store.supportInboxItems.find(
        (i) => i.productFeedbackId === input.productFeedbackId,
      );
      if (existing) return existing;
    }

    let relatedRelationshipId: string | null = null;
    let relatedVenueName: string | null = null;
    if (productVenueId) {
      const rel = store.relationships.find(
        (r) => r.productSync?.venueId?.trim() === productVenueId,
      );
      if (rel) {
        relatedRelationshipId = rel.id;
        relatedVenueName = rel.venue.name || null;
      }
    }

    const item: SupportInboxItem = {
      id: `sfi_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
      surface,
      type: feedbackType,
      subject,
      body:
        safeBody([
          input.body,
          input.rating != null ? `Rating: ${input.rating}/10` : null,
          input.sourceUrl ? `URL: ${input.sourceUrl}` : null,
          ...attachmentLines,
        ]) || undefined,
      rating: input.rating ?? null,
      allowPublicShare: input.allowPublicShare === true,
      actorName: input.actorName?.trim() || null,
      actorEmail: input.email?.trim() || null,
      vendorId: input.vendorId?.trim() || null,
      clientId: input.clientId?.trim() || null,
      relatedVenueId: productVenueId,
      relatedRelationshipId,
      relatedVenueName,
      productFeedbackId: input.productFeedbackId ?? null,
      sourceUrl: input.sourceUrl ?? null,
      attachmentCount: attachmentUrls.length > 0 ? attachmentUrls.length : undefined,
      attachmentUrls: attachmentUrls.length > 0 ? attachmentUrls : undefined,
      status: "open",
      createdAt: now,
      resolvedAt: null,
    };

    store.supportInboxItems.unshift(item);

    if (relatedRelationshipId) {
      const who =
        input.actorName?.trim() ||
        input.email?.trim() ||
        (surface === "client" ? "Client" : "Vendor");
      store.notifications.unshift({
        id: `ntf_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
        type:
          feedbackType === "support" || feedbackType === "bug"
            ? "support_request_submitted"
            : "feedback_received",
        relationshipId: relatedRelationshipId,
        title: `${surface === "client" ? "Client" : "Vendor"}: ${labels.notificationTitle}`,
        body: `${who} submitted ${labels.title.toLowerCase()} from product.`,
        createdAt: now,
        read: false,
        href: null,
        meta: {
          support_inbox_item_id: item.id,
          panel: "support",
          feedback_type: feedbackType,
          surface,
          venue_name: relatedVenueName ?? undefined,
        },
      });
    }

    return item;
  });

  return result;
}
