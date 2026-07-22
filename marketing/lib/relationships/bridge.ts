/**
 * Bridge marketing inquiry / enrollment events → shared Relationship store.
 * Failures are logged; they must not break the public form or Stripe path.
 */

import {
  ingestCheckoutStarted,
  ingestContactForm,
  ingestNewsletterSignup,
  ingestSubscriptionLifecycle,
  ingestSubscriptionPurchased,
  ingestSupportRequest,
  ingestWalkthroughCanceled,
  ingestWalkthroughRequest,
  ingestWelcomeBackRequest,
} from "@shared/relationships";
import type { OnboardingType } from "@/lib/marketing/enrollment";
import type { InquirySubmission } from "@/lib/inquiries/types";
import type { VenueEnrollmentRecord } from "@/lib/crm/types";
import { estimateMrrCentsFromPlan } from "@/lib/stripe/mrr";

export async function syncInquiryToRelationship(
  submission: InquirySubmission,
): Promise<void> {
  try {
    const f = submission.fields;
    switch (submission.kind) {
      case "contact":
        await ingestContactForm({
          name: f.name,
          email: f.email,
          venueName: f.venue || f.venueName,
          message: f.message,
          sourceId: submission.id,
        });
        break;
      case "walkthrough":
        await ingestWalkthroughRequest({
          name: f.name,
          email: f.email,
          venueName: f.venue || f.venueName,
          message: f.message,
          scheduledAt: f.scheduledAt || f.preferredDate || null,
          sourceId: submission.id,
        });
        break;
      case "welcome_back_request":
        await ingestWelcomeBackRequest({
          businessName: f.businessName,
          venueName: f.venueName || f.venue,
          firstName: f.firstName,
          lastName: f.lastName,
          email: f.businessEmail || f.email,
          phone: f.phone,
          notes: f.notes || f.message,
          yearsWithWeven: f.yearsWithWeven,
          sourceId: submission.id,
        });
        break;
      case "newsletter":
        await ingestNewsletterSignup({
          email: f.email,
          name: f.name,
          venueName: f.venue || f.venueName,
          sourceId: submission.id,
        });
        break;
      case "support":
        await ingestSupportRequest({
          name: f.name,
          email: f.email,
          venueName: f.venue || f.venueName,
          message: f.message,
          sourceId: submission.id,
        });
        break;
    }
  } catch (error) {
    console.error("[relationships] failed to sync inquiry", submission.id, error);
  }
}

export async function syncEnrollmentToRelationship(
  record: VenueEnrollmentRecord,
): Promise<{ relationshipId: string } | null> {
  try {
    const mrrCents =
      typeof record.mrrCents === "number" && record.mrrCents > 0
        ? record.mrrCents
        : estimateMrrCentsFromPlan(record.plan);

    const result = await ingestSubscriptionPurchased({
      email: record.customerEmail,
      venueName: record.venueName,
      plan: record.plan,
      planName: record.planName,
      foundingMember: record.foundingMember,
      welcomeBackRequested: record.welcomeBackRequested,
      onboardingType:
        record.onboardingType === "white_glove" ? "white_glove" : "self_guided",
      stripeSubscriptionId: record.stripeSubscriptionId,
      stripeCustomerId: record.stripeCustomerId,
      stripeCheckoutSessionId: record.stripeCheckoutSessionId,
      mrrCents,
      subscriptionStatus:
        record.paymentStatus === "successful" ? "active" : "trialing",
    });
    return { relationshipId: result.relationship.id };
  } catch (error) {
    console.error("[relationships] failed to sync enrollment", record.id, error);
    return null;
  }
}

export async function syncSubscriptionLifecycleToRelationship(input: {
  email?: string | null;
  venueName?: string | null;
  plan?: string | null;
  planName?: string | null;
  foundingMember?: boolean;
  welcomeBackRequested?: boolean;
  onboardingType?: OnboardingType | null;
  stripeSubscriptionId: string;
  stripeCustomerId?: string | null;
  mrrCents?: number;
  stripeStatus: string;
  deleted?: boolean;
  allowCreate?: boolean;
}): Promise<void> {
  try {
    await ingestSubscriptionLifecycle({
      email: input.email,
      venueName: input.venueName,
      plan: input.plan,
      planName: input.planName,
      foundingMember: input.foundingMember,
      welcomeBackRequested: input.welcomeBackRequested,
      onboardingType:
        input.onboardingType === "white_glove" ||
        input.onboardingType === "self_guided"
          ? input.onboardingType
          : null,
      stripeSubscriptionId: input.stripeSubscriptionId,
      stripeCustomerId: input.stripeCustomerId,
      mrrCents: input.mrrCents,
      stripeStatus: input.stripeStatus,
      deleted: input.deleted,
      allowCreate: input.allowCreate,
    });
  } catch (error) {
    console.error(
      "[relationships] failed to sync subscription lifecycle",
      input.stripeSubscriptionId,
      error,
    );
  }
}

export async function syncCheckoutStartedToRelationship(input: {
  email?: string | null;
  venueName?: string | null;
  plan?: string | null;
  planName?: string | null;
  welcomeBack?: boolean;
  onboardingType?: OnboardingType;
  checkoutSessionId?: string | null;
}): Promise<void> {
  try {
    await ingestCheckoutStarted(input);
  } catch (error) {
    console.error("[relationships] failed to sync checkout start", error);
  }
}

export async function syncCalendlyCreatedToRelationship(input: {
  email: string;
  name?: string;
  venueName?: string;
  scheduledAt?: string | null;
  message?: string;
  sourceId?: string;
}): Promise<void> {
  try {
    await ingestWalkthroughRequest({
      name: input.name,
      email: input.email,
      venueName: input.venueName,
      message: input.message,
      scheduledAt: input.scheduledAt,
      sourceId: input.sourceId,
      referralSource: "Calendly",
    });
  } catch (error) {
    console.error("[relationships] failed to sync Calendly invitee.created", error);
    throw error;
  }
}

export async function syncCalendlyCanceledToRelationship(input: {
  email: string;
  name?: string;
  venueName?: string;
  scheduledAt?: string | null;
  reason?: string | null;
  sourceId?: string;
}): Promise<void> {
  try {
    await ingestWalkthroughCanceled({
      email: input.email,
      name: input.name,
      venueName: input.venueName,
      scheduledAt: input.scheduledAt,
      reason: input.reason,
      sourceId: input.sourceId,
    });
  } catch (error) {
    console.error("[relationships] failed to sync Calendly invitee.canceled", error);
    throw error;
  }
}
