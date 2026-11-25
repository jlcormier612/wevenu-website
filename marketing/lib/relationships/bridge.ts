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
import { notifyProgram3IngestEvent } from "@/lib/relationships/notify-program3";
import { estimateMrrCentsFromPlan } from "@/lib/stripe/mrr";

/** Combine venue context + more-info question for Relationship notes/timeline. */
function composeWalkthroughMessage(fields: Record<string, string>): string | undefined {
  const venueContext = fields.message?.trim() ?? "";
  const question = fields.question?.trim() ?? "";
  if (!venueContext && !question) return undefined;
  if (!question) return venueContext || undefined;
  if (!venueContext) {
    return `Question/information you're requesting:\n${question}`;
  }
  return [
    "About your venue:",
    venueContext,
    "",
    "Question/information you're requesting:",
    question,
  ].join("\n");
}

function personNameFields(f: Record<string, string>): {
  name?: string;
  firstName?: string;
  lastName?: string;
} {
  const firstName = f.firstName?.trim() || undefined;
  const lastName = f.lastName?.trim() || undefined;
  const combined =
    f.name?.trim() ||
    [firstName, lastName].filter(Boolean).join(" ") ||
    undefined;
  return { name: combined, firstName, lastName };
}

function statusForInquiryKind(
  kind: InquirySubmission["kind"],
  fields: Record<string, string>,
): string {
  if (kind === "support") return "support";
  if (kind === "walkthrough") {
    const raw =
      fields.scheduledAt?.trim() || fields.preferredDate?.trim() || "";
    if (raw) {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) return "walkthrough_scheduled";
    }
    return "walkthrough_requested";
  }
  return "inquiry";
}

export async function syncInquiryToRelationship(
  submission: InquirySubmission,
): Promise<{ relationshipId: string; handoffToken?: string } | null> {
  try {
    const f = submission.fields;
    const person = personNameFields(f);
    let synced: { relationshipId: string; handoffToken?: string } | null =
      null;
    switch (submission.kind) {
      case "contact": {
        const result = await ingestContactForm({
          name: person.name,
          firstName: person.firstName,
          lastName: person.lastName,
          email: f.email,
          venueName: f.venue || f.venueName,
          message: f.message,
          sourceId: submission.id,
          acquisitionAttribution: submission.acquisitionAttribution,
        });
        synced = { relationshipId: result.relationship.id };
        break;
      }
      case "walkthrough": {
        const result = await ingestWalkthroughRequest({
          name: person.name,
          firstName: person.firstName,
          lastName: person.lastName,
          email: f.email,
          venueName: f.venue || f.venueName,
          message: composeWalkthroughMessage(f),
          scheduledAt: f.scheduledAt || f.preferredDate || null,
          sourceId: submission.id,
          referralSource: "Schedule a Walkthrough",
          acquisitionAttribution: submission.acquisitionAttribution,
        });
        synced = {
          relationshipId: result.relationship.id,
          handoffToken: result.handoffToken,
        };
        break;
      }
      case "welcome_back_request": {
        const result = await ingestWelcomeBackRequest({
          businessName: f.businessName,
          venueName: f.venueName || f.venue,
          firstName: f.firstName,
          lastName: f.lastName,
          email: f.businessEmail || f.email,
          phone: f.phone,
          notes: f.notes || f.message,
          yearsWithWeven: f.yearsWithWeven,
          sourceId: submission.id,
          acquisitionAttribution: submission.acquisitionAttribution,
        });
        synced = { relationshipId: result.relationship.id };
        break;
      }
      case "newsletter": {
        const result = await ingestNewsletterSignup({
          email: f.email,
          name: f.name,
          venueName: f.venue || f.venueName,
          sourceId: submission.id,
          acquisitionAttribution: submission.acquisitionAttribution,
        });
        synced = { relationshipId: result.relationship.id };
        break;
      }
      case "support": {
        const result = await ingestSupportRequest({
          name: person.name,
          firstName: person.firstName,
          lastName: person.lastName,
          email: f.email,
          venueName: f.venue || f.venueName,
          message: f.message,
          sourceId: submission.id,
          acquisitionAttribution: submission.acquisitionAttribution,
        });
        synced = { relationshipId: result.relationship.id };
        break;
      }
    }

    if (synced?.relationshipId) {
      await notifyProgram3IngestEvent({
        event: "status_enter",
        relationshipId: synced.relationshipId,
        status: statusForInquiryKind(submission.kind, submission.fields),
        sourceId: submission.id,
      });
    }
    return synced;
  } catch (error) {
    console.error("[relationships] failed to sync inquiry", submission.id, error);
    return null;
  }
}

export async function syncEnrollmentToRelationship(
  record: VenueEnrollmentRecord,
  owner?: { firstName?: string | null; lastName?: string | null },
): Promise<{
  relationshipId: string;
  activationToken: string | null;
  firstName: string;
  venueName: string;
  purchaseHold: boolean;
} | null> {
  try {
    const mrrCents =
      typeof record.mrrCents === "number" && record.mrrCents > 0
        ? record.mrrCents
        : estimateMrrCentsFromPlan(record.plan);

    const result = await ingestSubscriptionPurchased({
      email: record.customerEmail,
      venueName: record.venueName,
      firstName: owner?.firstName,
      lastName: owner?.lastName,
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
    // enterOnboardingAfterPurchase already minted activationToken for Launch Yourself
    // (cleared / deferred for White Glove).
    return {
      relationshipId: result.relationship.id,
      activationToken: result.purchaseHold
        ? null
        : (result.relationship.activationToken ?? null),
      firstName: result.relationship.owner.firstName,
      venueName: result.relationship.venue.name,
      purchaseHold: Boolean(result.purchaseHold),
    };
  } catch (error) {
    console.error("[relationships] failed to sync enrollment", record.id, error);
    throw error;
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
  acquisitionAttribution?: Parameters<
    typeof ingestCheckoutStarted
  >[0]["acquisitionAttribution"];
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
  handoffToken?: string;
  tracking?: {
    utm_campaign?: string | null;
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_content?: string | null;
    utm_term?: string | null;
  };
}): Promise<void> {
  try {
    const hasHandoff = Boolean(input.handoffToken?.trim());
    const hasVenue = Boolean(input.venueName?.trim());
    const { acquisitionAttributionFromCalendlyTracking } = await import(
      "@/lib/calendly/acquisition-from-tracking"
    );
    const acquisitionAttribution = acquisitionAttributionFromCalendlyTracking(
      input.tracking,
      { scheduledAt: input.scheduledAt },
    );
    const result = await ingestWalkthroughRequest({
      name: input.name,
      email: input.email,
      venueName: input.venueName,
      message: input.message,
      scheduledAt: input.scheduledAt,
      sourceId: input.sourceId,
      handoffToken: input.handoffToken,
      // Handoff remains authoritative when present. Direct Calendly with a
      // required venue answer matches email+venue. Only flag when neither
      // handoff nor venue identity is available.
      identityReviewRequired: !hasHandoff && !hasVenue,
      referralSource: hasHandoff ? "Schedule a Walkthrough" : "Calendly",
      ...(acquisitionAttribution ? { acquisitionAttribution } : {}),
    });
    const hasDate = Boolean(
      input.scheduledAt && !Number.isNaN(new Date(input.scheduledAt).getTime()),
    );
    await notifyProgram3IngestEvent({
      event: "status_enter",
      relationshipId: result.relationship.id,
      status: hasDate ? "walkthrough_scheduled" : "walkthrough_requested",
      sourceId: input.sourceId ?? null,
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
  handoffToken?: string;
}): Promise<void> {
  try {
    const result = await ingestWalkthroughCanceled({
      email: input.email,
      name: input.name,
      venueName: input.venueName,
      scheduledAt: input.scheduledAt,
      reason: input.reason,
      sourceId: input.sourceId,
      handoffToken: input.handoffToken,
    });
    if (result?.relationship?.id) {
      await notifyProgram3IngestEvent({
        event: "walkthrough_canceled",
        relationshipId: result.relationship.id,
        previousStatus: "walkthrough_scheduled",
        sourceId: input.sourceId ?? null,
      });
    }
  } catch (error) {
    console.error("[relationships] failed to sync Calendly invitee.canceled", error);
    throw error;
  }
}
